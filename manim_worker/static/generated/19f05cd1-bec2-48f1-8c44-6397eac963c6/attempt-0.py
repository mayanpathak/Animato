from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        title = Text("Plant Cell Structure", font_size=32).to_edge(UP, buff=0.3)
        self.play(FadeIn(title, shift=DOWN * 0.2), run_time=0.6)

        cell_wall = RoundedRectangle(
            width=5.8, height=4.2, corner_radius=0.4,
            color=GREEN_E, stroke_width=6
        ).shift(DOWN * 0.2)
        wall_label = Text("Cell Wall", font_size=20, color=GREEN_B).next_to(cell_wall, UP, buff=0.15)

        self.play(Create(cell_wall), FadeIn(wall_label), run_time=1.2)

        cell_membrane = RoundedRectangle(
            width=5.3, height=3.7, corner_radius=0.3,
            color=TEAL, stroke_width=3, fill_color=TEAL_E, fill_opacity=0.25
        ).move_to(cell_wall)
        membrane_label = Text("Cell Membrane", font_size=20, color=TEAL_B).next_to(cell_wall, DOWN, buff=0.15)

        self.play(Create(cell_membrane), FadeIn(membrane_label), run_time=1.2)

        cyto_label = Text("Cytoplasm", font_size=20, color=YELLOW_B).move_to(
            cell_wall.get_center() + UP * 1.1 + RIGHT * 1.2
        )
        self.play(FadeIn(cyto_label, shift=UP * 0.1), run_time=0.8)

        nucleus = Circle(
            radius=0.55, color=PURPLE_B, fill_color=PURPLE_D, fill_opacity=0.8, stroke_width=3
        ).move_to(cell_wall.get_center() + LEFT * 1.3 + DOWN * 0.2)
        nuc_label = Text("Nucleus", font_size=18, color=PURPLE_B).next_to(nucleus, DOWN, buff=0.12)

        self.play(FadeIn(nucleus, scale=0.6), Write(nuc_label), run_time=1.2)

        chloroplast = Ellipse(
            width=0.9, height=0.5, color=GREEN_B, fill_color=GREEN_D, fill_opacity=0.8, stroke_width=3
        ).move_to(cell_wall.get_center() + RIGHT * 1.3 + DOWN * 0.4)
        chloro_label = Text("Chloroplast", font_size=18, color=GREEN_B).next_to(chloroplast, DOWN, buff=0.12)

        self.play(FadeIn(chloroplast, scale=0.6), Write(chloro_label), run_time=1.2)

        full_cell = VGroup(
            cell_wall, wall_label, cell_membrane, membrane_label,
            cyto_label, nucleus, nuc_label, chloroplast, chloro_label
        )
        self.play(full_cell.animate.scale(1.05), run_time=0.6)
        self.play(full_cell.animate.scale(1 / 1.05), run_time=0.6)

        self.wait()