from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        cell_wall = RoundedRectangle(
            corner_radius=0.4,
            width=5.2,
            height=4.2,
            color=GREEN_D,
            stroke_width=7
        ).shift(LEFT * 1.5)
        lbl_wall = Text("Cell Wall", font_size=24, color=GREEN_C).next_to(cell_wall, UP, buff=0.25)

        cell_membrane = RoundedRectangle(
            corner_radius=0.3,
            width=4.8,
            height=3.8,
            color=YELLOW,
            stroke_width=3.5
        ).move_to(cell_wall)
        lbl_mem = Text("Cell Membrane", font_size=24, color=YELLOW).next_to(cell_wall, DOWN, buff=0.25)

        cytoplasm = RoundedRectangle(
            corner_radius=0.25,
            width=4.6,
            height=3.6,
            fill_color=TEAL_E,
            fill_opacity=0.35,
            stroke_width=0
        ).move_to(cell_wall)

        lbl_cyto = Text("Cytoplasm", font_size=24, color=TEAL_B)
        lbl_nuc = Text("Nucleus", font_size=24, color=PURPLE_B)
        lbl_chloro = Text("Chloroplast", font_size=24, color=GREEN_B)

        label_group = VGroup(lbl_cyto, lbl_nuc, lbl_chloro).arrange(DOWN, aligned_edge=LEFT, buff=0.85)
        label_group.to_edge(RIGHT, buff=0.9)

        nucleus = Circle(
            radius=0.55,
            color=PURPLE_A,
            fill_color=PURPLE,
            fill_opacity=0.7,
            stroke_width=3
        ).move_to(cell_wall.get_center() + LEFT * 0.8 + DOWN * 0.2)

        chloroplast = Ellipse(
            width=0.9,
            height=0.55,
            color=GREEN_A,
            fill_color=GREEN_E,
            fill_opacity=0.8,
            stroke_width=2.5
        ).move_to(cell_wall.get_center() + RIGHT * 0.9 + DOWN * 0.6)

        arr_cyto = Arrow(
            lbl_cyto.get_left(),
            cell_wall.get_center() + UP * 0.8 + RIGHT * 0.3,
            buff=0.15,
            color=TEAL_B,
            stroke_width=3,
            tip_length=0.2
        )
        arr_nuc = Arrow(
            lbl_nuc.get_left(),
            nucleus.get_right(),
            buff=0.15,
            color=PURPLE_B,
            stroke_width=3,
            tip_length=0.2
        )
        arr_chloro = Arrow(
            lbl_chloro.get_left(),
            chloroplast.get_right(),
            buff=0.15,
            color=GREEN_B,
            stroke_width=3,
            tip_length=0.2
        )

        self.play(Create(cell_wall), Write(lbl_wall), run_time=1.4)
        self.play(Create(cell_membrane), Write(lbl_mem), run_time=1.3)
        self.play(FadeIn(cytoplasm), Write(lbl_cyto), Create(arr_cyto), run_time=1.3)
        self.play(
            FadeIn(nucleus, scale=0.6),
            Write(lbl_nuc),
            Create(arr_nuc),
            run_time=1.4
        )
        self.play(
            FadeIn(chloroplast, scale=0.6),
            Write(lbl_chloro),
            Create(arr_chloro),
            run_time=1.4
        )
        self.play(
            nucleus.animate.scale(1.08),
            chloroplast.animate.scale(1.08),
            rate_func=there_and_back,
            run_time=1.2
        )
        self.wait()