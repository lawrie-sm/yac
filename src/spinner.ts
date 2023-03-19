const textEncoder = new TextEncoder();
const spinnerFrames = ["|", "/", "-", "\\"];
let spinnerInterval: number;

export let isSpinnerRunning = false;

export function startSpinner() {
  isSpinnerRunning = true;

  let frame = 0;
  spinnerInterval = setInterval(() => {
    Deno.stdout.writeSync(textEncoder.encode("\x1b[1G" + spinnerFrames[frame]));
    frame = (frame + 1) % spinnerFrames.length;
  }, 100);
}

export function stopSpinner() {
  if (isSpinnerRunning) {
    isSpinnerRunning = false;
    clearInterval(spinnerInterval);
    Deno.stdout.writeSync(textEncoder.encode("\x1b[1G \x1b[1G"));
  }
}
