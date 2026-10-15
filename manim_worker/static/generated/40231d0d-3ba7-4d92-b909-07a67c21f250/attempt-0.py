from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        title = Text("Inner Solar System", font_size=36).to_edge(UP, buff=0.4)
        self.play(FadeIn(title, shift=DOWN * 0.3), run_time=0.8)

        sun = Dot(point=ORIGIN, radius=0.35, color=YELLOW)
        sun_glow = Circle(radius=0.45, color=GOLD, stroke_width=0, fill_opacity=0.3)
        sun_label = Text("Sun", font_size=20, color=YELLOW).next_to(sun, DOWN, buff=0.15)
        sun_group = VGroup(sun_glow, sun, sun_label)

        self.play(FadeIn(sun_group, scale=0.8), run_time=0.8)

        planet_data = [
            ("Mercury", 1.0, 0.08, GREY_A, 0.4),
            ("Venus", 1.7, 0.12, GOLD, 1.8),
            ("Earth", 2.4, 0.13, BLUE, 3.2),
            ("Mars", 3.1, 0.10, RED, 4.5),
        ]

        orbits = VGroup()
        planets = VGroup()
        labels = VGroup()

        for name, radius, p_size, p_color, angle in planet_data:
            orbit = Circle(radius=radius, color=GREY, stroke_width=1.5, stroke_opacity=0.5)
            pos = np.array([radius * np.cos(angle), radius * np.sin(angle), 0])
            planet = Dot(point=pos, radius=p_size, color=p_color)
            label = Text(name, font_size=18, color=p_color).next_to(planet, UR, buff=0.1)

            orbits.add(orbit)
            planets.add(planet)
            labels.add(label)

        for i in range(4):
            self.play(
                Create(orbits[i]),
                FadeIn(planets[i], scale=0.5),
                Write(labels[i]),
                run_time=0.7
            )

        self.play(FadeOut(labels), FadeOut(sun_label), run_time=0.6)

        speeds = [2.0, 1.4, 1.0, 0.7]
        animations = [
            Rotate(planets[i], angle=speeds[i] * PI, about_point=ORIGIN, rate_func=linear)
            for i in range(4)
        ]
        self.play(*animations, run_time=3.0)

        final_labels = VGroup()
        for i, (name, _, _, p_color, _) in enumerate(planet_data):
            lbl = Text(name, font_size=18, color=p_color).next_to(planets[i], UR, buff=0.1)
            final_labels.add(lbl)

        self.play(FadeIn(final_labels), run_time=0.6)
        self.wait()