from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        title = Text("Game Theory", font_size=40).to_edge(UP, buff=0.6)
        subtitle = Text("The Prisoner's Dilemma", font_size=24, color=BLUE_C).next_to(title, DOWN, buff=0.2)

        box_size = 1.6
        box_tl = Square(side_length=box_size, stroke_color=GREY_B).shift(LEFT * 0.85 + UP * 0.1)
        box_tr = Square(side_length=box_size, stroke_color=GREY_B).shift(RIGHT * 0.85 + UP * 0.1)
        box_bl = Square(side_length=box_size, stroke_color=GREY_B).shift(LEFT * 0.85 + DOWN * 1.6)
        box_br = Square(side_length=box_size, stroke_color=GREY_B).shift(RIGHT * 0.85 + DOWN * 1.6)
        grid = VGroup(box_tl, box_tr, box_bl, box_br)

        t_tl = MathTex("(3,\\, 3)", font_size=32).move_to(box_tl)
        t_tr = MathTex("(0,\\, 5)", font_size=32).move_to(box_tr)
        t_bl = MathTex("(5,\\, 0)", font_size=32).move_to(box_bl)
        t_br = MathTex("(1,\\, 1)", font_size=32).move_to(box_br)
        payoffs = VGroup(t_tl, t_tr, t_bl, t_br)

        nash_highlight = RoundedRectangle(
            corner_radius=0.1,
            width=box_size * 1.05,
            height=box_size * 1.05,
            color=YELLOW,
            stroke_width=4
        ).move_to(box_br)
        nash_label = Text("Nash Equilibrium", font_size=26, color=YELLOW).next_to(box_br, DOWN, buff=0.4)

        self.play(FadeIn(title, shift=DOWN * 0.3), FadeIn(subtitle, shift=DOWN * 0.3), run_time=1.0)
        self.play(Create(grid), Write(payoffs), run_time=1.5)
        self.play(Create(nash_highlight), FadeIn(nash_label, shift=UP * 0.2), run_time=1.2)
        self.play(
            nash_highlight.animate.set_fill(YELLOW, opacity=0.25),
            t_br.animate.set_color(YELLOW).scale(1.2),
            run_time=1.0
        )
        self.wait(1.5)