import React from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen  text-center">
      <div className="flex flex-col items-center">
        <div className="bg-red-100 text-red-600 rounded-full p-4 mb-4">
          <AlertTriangle size={48} />
        </div>
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          Page Not Found
        </h1>
        <p className="text-gray-600 mb-6">
          Oops! The page you are looking for doesn't exist or has been moved.
        </p>
        <Link href="/">
          <Button className="px-6 py-3 text-white bg-blue-600 hover:bg-blue-700">
            Go Back Home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
