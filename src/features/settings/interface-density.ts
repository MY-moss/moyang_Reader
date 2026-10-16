import { useEffect, useState } from "react";
type Density = "compact" | "comfortable";
const read = (): Density => (localStorage.getItem("moyang.density") === "compact" ? "compact" : "comfortable");
export function useInterfaceDensity() {
  const [density, setDensity] = useState(read);
  useEffect(() => {
    const update = () => setDensity(read());
    window.addEventListener("moyang:density", update);
    return () => window.removeEventListener("moyang:density", update);
  }, []);
  return [
    density,
    (value: Density) => {
      localStorage.setItem("moyang.density", value);
      setDensity(value);
      window.dispatchEvent(new Event("moyang:density"));
    },
  ] as const;
}
