"use server";

import prisma from "@/lib/prisma";
import { getDbUserId } from "./user.action";
import { revalidatePath } from "next/cache";

export async function createPost(content: string, image: string) {
  try {
    const userId = await getDbUserId();
    if (!userId) {
      return;
    }
    const post = await prisma.post.create({
      data: {
        content,
        image,
        authorId: userId,
      },
    });
    revalidatePath("/"); //basically relaod the home page for post that have been created

    return {
      success: true,
      post,
    };
  } catch (error) {
    console.log("Failed to create post", error);
  }
}

export async function getPosts() {
  try {
    const posts = await prisma.post.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
            username: true,
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                image: true,
                username: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        likes: {
          select: {
            userId: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });
    return posts;
  } catch (error) {
    console.log("Failed to get posts", error);
    throw new Error("Failed to get posts");
  }
}

export async function toggleLike(postId: string) {
  try {
    const userId = await getDbUserId();
    if (!userId) {
      return;
    }
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });
    const post = await prisma.post.findUnique({
      where: {
        id: postId,
      },
      select: {
        authorId: true,
      },
    });
    if (!post) {
      throw new Error("Post not found");
    }
    if (existingLike) {
      //unlike
      await prisma.like.delete({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });
    } else {
      //like
      await prisma.$transaction([
        //liking and create a post until u are not liking yourself
        prisma.like.create({
          data: {
            userId,
            postId,
          },
        }),

        ...(post.authorId !== userId
          ? [
              prisma.notification.create({
                data: {
                  type: "LIKE",
                  userId,
                  creatorId: post.authorId,
                  postId,
                },
              }),
            ]
          : []),
      ]);
    }
    revalidatePath("/"); //basically relaod the home page for post that have been liked
    return {
      success: true,
    };
  } catch (error) {
    console.error("Failed to toggle post", error);
    return {
      success: false,
      error: "Failed to toggle post",
    };
  }
}

export async function createComment(postId: string, content: string) {
  try {
    const userId = await getDbUserId();
    if (!userId) {
      return;
    }
    if (!content) {
      throw new Error("Content is required");
    }
    const post = await prisma.post.findUnique({
      where: {
        id: postId,
      },
      select: {
        authorId: true,
      },
    });
    if (!post) {
      throw new Error("Post not found");
    }
    //create comment and notification in a transaction
    const [comment] = await prisma.$transaction(async (tx) => {
      const newComment = await tx.comment.create({
        data: {
          content,
          authorId: userId,
          postId,
        },
      });
      //create notification if comment on someone else's post
      if (post.authorId !== userId) {
        await tx.notification.create({
          data: {
            type: "COMMENT",
            userId: post.authorId,
            creatorId: userId,
            postId,
            commentId: newComment.id,
          },
        });
      }
      return [newComment];
    });
    revalidatePath("/");
    return {
      success: true,
      comment,
    };
  } catch (error) {
    console.error("Failed to create comment", error);
    return {
      success: false,
      error: "Failed to create comment",
    };
  }
}
export async function deletePost(postId: string) {
  try {
    const userId = await getDbUserId();
    const post = await prisma.post.findUnique({
      where: {
        id: postId,
      },
      select: {
        authorId: true,
      },
    });
    if (!post) throw new Error("Post not found");
    if (post.authorId !== userId) {
      throw new Error("Unauthorized -no delete permsission");
    }
    await prisma.post.delete({
      where: {
        id: postId,
      },
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting post", error);
    return { success: false, error: "Failed to Delete post" };
  }
}
