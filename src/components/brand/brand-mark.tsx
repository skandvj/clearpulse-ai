import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
  alt?: string;
  priority?: boolean;
}

export function BrandMark({
  className,
  alt = "ClearPulse",
  priority = false,
}: BrandMarkProps) {
  return (
    <Image
      src="/icon.svg"
      alt={alt}
      width={44}
      height={44}
      priority={priority}
      className={cn("h-11 w-11 shrink-0", className)}
    />
  );
}
