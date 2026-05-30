import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-maroon-100 flex items-center justify-center mb-6">
        <span className="text-3xl font-bold text-maroon-700">404</span>
      </div>
      <h1 className="text-2xl font-bold text-stone-900 mb-2">Page Not Found</h1>
      <p className="text-stone-500 mb-6">Looks like this page went out of bounds.</p>
      <Link href="/">
        <Button>Back to Home</Button>
      </Link>
    </div>
  );
}
