import awardsData from "@/data/awards.json";
import { setBundledAwards } from "./awards-history";

// Desktop's boot decision, imported for its side effect by main.tsx before the
// root mounts. Keeping the static import in a module of its own is what lets
// the television entry leave 4.2MB out of its graph entirely: rollup only pulls
// data/awards.json eagerly into the entries that can reach this file.
setBundledAwards(awardsData);
