from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        title = Text("The Inner Solar System", font_size=28)
        title.to_edge(UP, buff=0.35)

        sun = Dot(point=ORIGIN, radius=0.28, color=YELLOW)
        sun_glow = Circle(radius=0.38, color=GOLD, stroke_width=0, fill_opacity=0.3)
        sun_label = Text("Sun", font_size=18, color=YELLOW).next_to(sun, DOWN, buff=0.12)
        sun_group = VGroup(sun_glow, sun)

        radii = [1.0, 1.6, 2.2, 2.9]
        orbits = VGroup(*[
            Circle(radius=r, color=GREY_C, stroke_width=1.2, stroke_opacity=0.6)
            for r in radii
        ])

        mercury = Dot(point=RIGHT * radii[0], radius=0.08, color=GREY_A)
        venus = Dot(point=UP * radii[1], radius=0.12, color=GOLD)
        earth = Dot(point=LEFT * radii[2], radius=0.13, color=BLUE)
        mars = Dot(point=DOWN * radii[3], radius=0.10, color=RED)

        m_label = Text("Mercury", font_size=16, color=GREY_A).next_to(mercury, UR, buff=0.08)
        v_label = Text("Venus", font_size=16, color=GOLD).next_to(venus, UR, buff=0.08)
        e_label = Text("Earth", font_size=16, color=BLUE).next_to(earth, UL, buff=0.08)
        ma_label = Text("Mars", font_size=16, color=RED).next_to(mars, DL, buff=0.08)

        planets = [mercury, venus, earth, mars]
        labels = [m_label, v_label, e_label, ma_label]

        self.play(FadeIn(title), FadeIn(sun_group), Write(sun_label), run_time=1.0)
        self.play(Create(orbits), run_time=1.0)

        for p, lbl in zip(planets, labels):
            self.play(FadeIn(p), FadeIn(lbl), run_time=0.5)

        status = Text("Planets orbit the Sun", font_size=22, color=YELLOW)
        status.to_edge(DOWN, buff=0.35)

        self.play(
            FadeIn(status),
            FadeOut(sun_label),
            *[FadeOut(lbl) for lbl in labels],
            run_time=0.6
        )

        self.play(
            Rotate(mercury, angle=3.0 * TAU, about_point=ORIGIN, rate_func=linear),
            Rotate(venus, angle=1.8 * TAU, about_point=ORIGIN, rate_func=linear),
            Rotate(earth, angle=1.2 * TAU, about_point=ORIGIN, rate_func=linear),
            Rotate(mars, angle=0.8 * TAU, about_point=ORIGIN, rate_func=linear),
            run_time=3.5
        )
        self.wait()