"""Build lightweight, deterministic GIF previews for the GitHub README."""

from pathlib import Path

import cv2
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "readme"


def build_scene_preview() -> None:
    source = ROOT / "assets" / "videos" / "neon-listening-lounge-draft-30fps.mp4"
    capture = cv2.VideoCapture(str(source))
    source_fps = capture.get(cv2.CAP_PROP_FPS) or 30
    sample_every = max(1, round(source_fps / 8))
    frames: list[Image.Image] = []
    frame_number = 0

    while True:
        ok, frame = capture.read()
        if not ok:
            break
        if frame_number % sample_every == 0:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            image = Image.fromarray(rgb)
            height = round(image.height * 280 / image.width)
            image = image.resize((280, height), Image.Resampling.LANCZOS)
            frames.append(image.quantize(colors=128, method=Image.Quantize.MEDIANCUT))
        frame_number += 1

    capture.release()
    if not frames:
        raise RuntimeError(f"No frames decoded from {source}")

    frames[0].save(
        OUTPUT / "radiance-scene.gif",
        save_all=True,
        append_images=frames[1:],
        duration=round(1000 * sample_every / source_fps),
        loop=0,
        optimize=True,
    )


def build_pet_preview() -> None:
    source = Image.open(
        ROOT / "assets" / "pets" / "radiance-butterfly" / "spritesheet.png"
    ).convert("RGBA")
    columns, rows = 8, 11
    cell_width = source.width // columns
    cell_height = source.height // rows
    frames: list[Image.Image] = []

    for column in range(columns):
        cell = source.crop(
            (
                column * cell_width,
                0,
                (column + 1) * cell_width,
                cell_height,
            )
        )
        cell.thumbnail((170, 190), Image.Resampling.LANCZOS)
        frames.append(cell)

    frames[0].save(
        OUTPUT / "radiance-pet.gif",
        save_all=True,
        append_images=frames[1:],
        duration=180,
        loop=0,
        disposal=2,
        optimize=True,
    )


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    build_scene_preview()
    build_pet_preview()
