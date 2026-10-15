from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        url_box = RoundedRectangle(
            corner_radius=0.2,
            height=0.9,
            width=7.2,
            color=GREY_B,
            fill_color=GREY_E,
            fill_opacity=0.7
        )
        url_text = Text("http://localhost:5173/", font_size=32, color=WHITE)
        url_text.move_to(url_box)
        url_group = VGroup(url_box, url_text).shift(UP * 2.2)

        dot_status = Dot(radius=0.1, color=GREEN).next_to(url_box, LEFT, buff=0.35)
        status_label = Text("Vite Dev Server Active", font_size=22, color=GREEN).next_to(url_group, DOWN, buff=0.35)

        window_frame = RoundedRectangle(
            corner_radius=0.2,
            height=3.0,
            width=6.6,
            color=BLUE_C,
            fill_color=GREY_E,
            fill_opacity=0.4
        ).shift(DOWN * 1.1)

        dot_r = Dot(radius=0.07, color=RED).shift(DOWN * 1.1 + UP * 1.2 + LEFT * 2.9)
        dot_y = Dot(radius=0.07, color=YELLOW).next_to(dot_r, RIGHT, buff=0.15)
        dot_g = Dot(radius=0.07, color=GREEN).next_to(dot_y, RIGHT, buff=0.15)
        nav_dots = VGroup(dot_r, dot_y, dot_g)

        card_left = RoundedRectangle(
            corner_radius=0.12,
            height=1.6,
            width=2.7,
            color=TEAL,
            fill_color=TEAL_E,
            fill_opacity=0.5
        ).shift(DOWN * 1.25 + LEFT * 1.5)

        card_right = RoundedRectangle(
            corner_radius=0.12,
            height=1.6,
            width=2.7,
            color=PURPLE,
            fill_color=PURPLE_E,
            fill_opacity=0.5
        ).shift(DOWN * 1.25 + RIGHT * 1.5)

        text_left = Text("Fast HMR", font_size=20, color=WHITE).move_to(card_left)
        text_right = Text("Localhost: Ready", font_size=20, color=WHITE).move_to(card_right)

        self.play(Create(url_box), Write(url_text), run_time=1.2)
        self.play(
            FadeIn(dot_status, scale=0.5),
            FadeIn(status_label, shift=UP * 0.2),
            url_box.animate.set_stroke(TEAL, 2.5),
            run_time=1.0
        )
        self.play(
            Create(window_frame),
            FadeIn(nav_dots, shift=DOWN * 0.1),
            run_time=1.2
        )
        self.play(
            FadeIn(card_left, shift=UP * 0.3),
            FadeIn(card_right, shift=UP * 0.3),
            Write(text_left),
            Write(text_right),
            run_time=1.2
        )
        self.play(
            card_left.animate.set_stroke(YELLOW, 2),
            card_right.animate.set_stroke(YELLOW, 2),
            run_time=0.8
        )
        self.wait()