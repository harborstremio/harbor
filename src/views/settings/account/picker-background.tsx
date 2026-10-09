import { useEffect, useState } from "react";
import { BackgroundPicker } from "../theme-panel/background-picker";
import { loadPickerBg, savePickerBg, savePickerBgDim } from "@/lib/theme-storage";

export function PickerBackground() {
  const [image, setImage] = useState<string | null>(null);
  const [dim, setDim] = useState(55);

  useEffect(() => {
    let alive = true;
    void loadPickerBg().then((v) => {
      if (!alive) return;
      setImage(v.image);
      setDim(v.dim);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <BackgroundPicker
      variant="picker"
      imageData={image}
      dim={dim / 100}
      onImageChange={(data) => {
        setImage(data);
        void savePickerBg(data);
      }}
      onDimChange={(next) => {
        const pct = Math.round(next * 100);
        setDim(pct);
        void savePickerBgDim(pct);
      }}
    />
  );
}
