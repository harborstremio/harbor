import localFilesLogo from "@/assets/addon-logos/local-files.png";

export function LocalLibraryBrand({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return (
    <img
      src={localFilesLogo}
      alt=""
      aria-hidden
      draggable={false}
      className={`${className} shrink-0 rounded-[4px] object-contain`}
    />
  );
}
