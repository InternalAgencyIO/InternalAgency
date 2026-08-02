from __future__ import annotations

import importlib.util
import tempfile
from fractions import Fraction
from pathlib import Path

import av


def load_renderer():
    script = Path(__file__).with_name("render-world-country.py")
    spec = importlib.util.spec_from_file_location("world_country_video", script)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {script}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def create_source(path: Path) -> None:
    with av.open(str(path), "w", format="mp4") as container:
        stream = container.add_stream("libx264", rate=30)
        stream.width = 64
        stream.height = 96
        stream.pix_fmt = "yuv420p"
        for index in range(455):
            frame = av.VideoFrame(64, 96, "yuv420p")
            for plane in frame.planes:
                plane.update(bytes([index % 255]) * plane.buffer_size)
            frame.pts = index
            frame.time_base = Fraction(1, 30)
            for packet in stream.encode(frame):
                container.mux(packet)
        for packet in stream.encode(None):
            container.mux(packet)


def main() -> None:
    renderer = load_renderer()
    with tempfile.TemporaryDirectory(prefix="world-video-contract-") as directory:
        source = Path(directory) / "source.mp4"
        output = Path(directory) / "output.mp4"
        create_source(source)
        renderer.exact_15_second_master(source, output)
        metadata = renderer.inspect_video(output)

    assert metadata["frameCount"] == 450, metadata
    assert abs(float(metadata["fps"]) - 30.0) <= 0.01, metadata
    assert abs(float(metadata["durationSeconds"]) - 15.0) <= 0.01, metadata
    print("World country video contract validated: 450 frames, 30 fps, 15.000 seconds.")


if __name__ == "__main__":
    main()
