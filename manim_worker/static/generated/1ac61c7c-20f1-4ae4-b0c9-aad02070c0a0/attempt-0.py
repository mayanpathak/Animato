from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        title = Text("The Inner Solar System", font_size=32).to_edge(UP, buff=0.4)
        self.play(FadeIn(title, shift=DOWN * 0.3), run_time=0.8)

        sun = Circle(radius=0.4, color=YELLOW, fill_color=YELLOW, fill_opacity=1.0)
        sun_label = Text("Sun", font_size=18, color=BLACK, weight=BOLD).move_to(sun.get_center())
        sun_group = VGroup(sun, sun_label)

        radii = [1.1, 1.8, 2.5, 3.2]
        planet_colors = [GREY, GOLD, BLUE, RED]
        planet_names = ["Mercury", "Venus", "Earth", "Mars"]
        dot_radii = [0.08, 0.12, 0.13, 0.1]
        start_angles = [0.2, 1.8, 3.5, 5.0]

        orbit_circles = VGroup(*[
            Circle(radius=r, stroke_color=GREY_A, stroke_opacity=0.35, stroke_width=1.5)
            for r in radii
        ])

        self.play(
            FadeIn(sun_group, scale=0.8),
            Create(orbit_circles),
            run_time=1.2
        )

        planets = VGroup()
        labels = VGroup()

        for r, color, name, d_r, angle in zip(radii, planet_colors, planet_names, dot_radii, start_angles):
            pos = np.array([r * np.cos(angle), r * np.sin(angle), 0])
            dot = Dot(point=pos, radius=d_r, color=color)
            label = Text(name, font_size=16, color=WHITE)
            label.next_to(dot, direction=pos / np.linalg.norm(pos), buff=0.15)
            planets.add(dot)
            labels.add(label)

        self.play(
            LaggedStart(
                *[AnimationGroup(FadeIn(p, scale=0.5), Write(lbl)) for p, lbl in zip(planets, labels)],
                lag_ratio=0.3
            ),
            run_time=2.2
        )

        self.play(FadeOut(labels), run_time=0.6)

        self.play(
            Rotate(planets[0], angle=2.2 * PI, about_point=ORIGIN, rate_func=linear),
            Rotate(planets[1], angle=1.4 * PI, about_point=ORIGIN, rate_func=linear),
            Rotate(planets[2], angle=1.0 * PI, about_point=ORIGIN, rate_func=linear),
            Rotate(planets[3], angle=0.65 * PI, about_point=ORIGIN, rate_func=linear),
            run_time=3.0
        )

        self.wait()