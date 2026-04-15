import { InfiniteSlider } from "@/components/ui/infinite-slider";
import { cn } from "@/lib/utils";
import Image from "next/image";

type Logo = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
};

type LogoCloudProps = React.ComponentProps<"div"> & {
  logos: Logo[];
};

export function LogoCloud({ className, logos, ...props }: LogoCloudProps) {
  return (
    <div
      {...props}
      className={cn(
        "overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,8%,black,92%,transparent)]",
        className
      )}
    >
      <InfiniteSlider gap={42} reverse duration={25} durationOnHover={15}>
        {logos.map((logo) => (
          <Image
            alt={logo.alt}
            className="pointer-events-none h-4 select-none md:h-5 dark:brightness-0 dark:invert"
            height={40}
            key={`logo-${logo.alt}`}
            loading="lazy"
            src={logo.src}
            width={100}
          />
        ))}
      </InfiniteSlider>
    </div>
  );
}
