import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

const movie = fileURLToPath(new URL("../moyang-intro.mp4", import.meta.url));
const gif = fileURLToPath(new URL("../moyang-intro.gif", import.meta.url));
const poster = fileURLToPath(new URL("../moyang-intro-poster.png", import.meta.url));
function ffmpeg(args) {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("FFmpeg exited with code " + result.status);
}
ffmpeg([
  "-i",
  movie,
  "-filter_complex",
  "[0:v]fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle",
  "-loop",
  "0",
  gif,
]);
ffmpeg(["-ss", "1.8", "-i", movie, "-frames:v", "1", poster]);
