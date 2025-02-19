"use server";

import prisma from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { useId } from "react";

export async function syncUser() {
  try {
    const { userId } = await auth();
    const user = await currentUser();
    if (!user || !userId) {
      return;
    }
    const existingUser = await prisma.user.findUnique({
      where: {
        clerkId: userId,
      },
    });
    if (existingUser) {
      return existingUser;
    }
    const dbUser = await prisma.user.create({
      data: {
        clerkId: userId,
        name: `${user.firstName || ""} ${user.lastName || ""}`,
        username:
          user.username ?? user.emailAddresses[0].emailAddress.split("@")[0],
        email: user.emailAddresses[0].emailAddress,
        image: user.imageUrl,
      },
    });
    return dbUser;
  } catch (error) {
    console.log("Error in SyncUser", error);
  }
}

export async function getUserByClerkId(clerkId: string) {
  return await prisma.user.findUnique({
    where: {
      clerkId,
    },
    include: {
      _count: {
        select: {
          followers: true,
          following: true,
          posts: true,
        },
      },
    },
  });
}

export async function getDbUserId() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: {
      clerkId,
    },
  });
  if (!user) {
    throw new Error("User not found");
  }
  return user.id;
}

export async function getRandomUser() {
  try {
    const userId = await getDbUserId();
    if (!userId) {
      return [];
    }
    //get 3 random user whome we havent followed and exclude the current user
    const randomUsers = await prisma.user.findMany({
      where: {
        AND: [
          { NOT: { id: userId } }, //excluding current user
          {
            NOT: {
              //exlcuding the follwed users
              followers: {
                some: {
                  followerId: userId,
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        username: true,
        image: true,
        name: true,
        _count: {
          select: {
            followers: true,
          },
        },
      },
      take: 3,
    });
    return randomUsers;
  } catch (error) {
    console.log("error in getRandomUser", error);
    return [];
  }
}

export async function toggleFollow(targetUserId: string) {
  try {
    const userId = await getDbUserId();
    if (!userId) {
      return;
    }
    if (userId === targetUserId) {
      throw new Error("You Cannot follow yourself");
    }
    const existingFollow = await prisma.follows.findUnique({
      where: {
        //we use @index bacuse of this we can directly check this user is following or not query karne ke kaam aata hei
        followerId_followingId: {
          followerId: userId,
          followingId: targetUserId,
        },
      },
    });
    if (existingFollow) {
      await prisma.follows.delete({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: targetUserId,
          },
        },
      });
    } else {
      //transcation is basically used to perform both the queries in one transaction dono honahe chiye warna fail ho jaeyga
      await prisma.$transaction([
        prisma.follows.create({
          data: {
            followerId: userId,
            followingId: targetUserId,
          },
        }),
        prisma.notification.create({
          data: {
            type: "FOLLOW",
            userId: userId,
            creatorId: targetUserId,
          },
        }),
      ]);
    }
    revalidatePath("/");
    return {
      success: true,
    };
  } catch (error) {
    console.log("Error in toggleFollow", error);
    return {
      success: false,
      error: "Error in toggleFollow",
    };
  }
}
