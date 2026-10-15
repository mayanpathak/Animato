from manim import *
import numpy as np

class GeneratedScene(ThreeDScene):
    def construct(self):
        self.set_camera_orientation(phi=65 * DEGREES, theta=-60 * DEGREES)

        title = Text("Lifecycle of the Sun & Earth", font_size=32).to_edge(UP)
        stage1 = Text("Main Sequence: Stable System", font_size=24, color=YELLOW).to_edge(DOWN)
        stage2 = Text("Red Giant: Earth Engulfed", font_size=24, color=RED).to_edge(DOWN)
        stage3 = Text("White Dwarf & Planetary Nebula", font_size=24, color=BLUE_A).to_edge(DOWN)

        self.add_fixed_in_frame_mobjects(title, stage1)

        sun = Sphere(center=ORIGIN, radius=0.55, resolution=(8, 12), color=YELLOW)
        earth = Sphere(center=np.array([2.4, 0.0, 0.0]), radius=0.18, resolution=(6, 10), color=BLUE)
        orbit = Circle(radius=2.4, color=GREY_B).set_stroke(width=1.5, opacity=0.6)
        nebula_ring = Annulus(inner_radius=2.0, outer_radius=2.5, color=PURPLE, fill_opacity=0.35)

        self.play(
            FadeIn(title),
            FadeIn(stage1),
            Create(orbit),
            FadeIn(sun),
            FadeIn(earth),
            run_time=1.5,
        )

        self.add_fixed_in_frame_mobjects(stage2)
        self.move_camera(
            phi=75 * DEGREES,
            theta=-25 * DEGREES,
            added_anims=[
                FadeOut(stage1),
                FadeIn(stage2),
                sun.animate.scale(3.8).set_color(RED),
                FadeOut(earth),
                FadeOut(orbit),
            ],
            run_time=3.0,
        )

        self.add_fixed_in_frame_mobjects(stage3)
        self.play(
            FadeOut(stage2),
            FadeIn(stage3),
            sun.animate.scale(0.08).set_color(WHITE),
            FadeIn(nebula_ring, scale=0.6),
            run_time=2.5,
        )

        self.wait()