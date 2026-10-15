from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        title = Text("Plant Cell Structure", font_size=32).to_edge(UP, buff=0.4)
        self.play(FadeIn(title, shift=DOWN * 0.3), run_time=0.6)

        cell_center = np.array([-1.6, -0.2, 0])

        cell_wall = RoundedRectangle(
            corner_radius=0.35,
            width=4.0,
            height=4.4,
            color=GREEN_E,
            stroke_width=7
        ).move_to(cell_center)

        arrow_wall = Arrow(
            start=np.array([1.3, 1.5, 0]),
            end=np.array([0.42, 1.5, 0]),
            buff=0.08,
            color=GREEN_C,
            stroke_width=2.5,
            max_tip_length_to_length_ratio=0.25
        )
        lbl_wall = Text("Cell Wall", font_size=20, color=GREEN_C).next_to(arrow_wall, RIGHT, buff=0.15)

        self.play(
            Create(cell_wall),
            Create(arrow_wall),
            Write(lbl_wall),
            run_time=1.2
        )

        cell_membrane = RoundedRectangle(
            corner_radius=0.28,
            width=3.7,
            height=4.1,
            color=TEAL,
            stroke_width=3
        ).move_to(cell_center)

        arrow_mem = Arrow(
            start=np.array([1.3, 0.85, 0]),
            end=np.array([0.27, 0.85, 0]),
            buff=0.08,
            color=TEAL,
            stroke_width=2.5,
            max_tip_length_to_length_ratio=0.25
        )
        lbl_mem = Text("Cell Membrane", font_size=20, color=TEAL).next_to(arrow_mem, RIGHT, buff=0.15)

        self.play(
            Create(cell_membrane),
            Create(arrow_mem),
            Write(lbl_mem),
            run_time=1.0
        )

        nucleus_core = Circle(
            radius=0.5,
            color=PURPLE_B,
            fill_color=PURPLE_D,
            fill_opacity=0.7,
            stroke_width=3
        ).move_to(cell_center + np.array([0.1, 0.4, 0]))
        nucleolus = Dot(nucleus_core.get_center(), radius=0.12, color=PURPLE_A)
        nucleus = VGroup(nucleus_core, nucleolus)

        arrow_nuc = Arrow(
            start=np.array([1.3, 0.2, 0]),
            end=nucleus_core.get_right() + UP * 0.05,
            buff=0.08,
            color=PURPLE_B,
            stroke_width=2.5,
            max_tip_length_to_length_ratio=0.25
        )
        lbl_nuc = Text("Nucleus", font_size=20, color=PURPLE_B).next_to(arrow_nuc, RIGHT, buff=0.15)

        self.play(
            FadeIn(nucleus, scale=0.7),
            Create(arrow_nuc),
            Write(lbl_nuc),
            run_time=1.0
        )

        cyto_seed = Circle(radius=0.2, color=YELLOW_D, fill_color=YELLOW_D, fill_opacity=0.3).move_to(cell_center)
        cytoplasm = RoundedRectangle(
            corner_radius=0.25,
            width=3.6,
            height=4.0,
            color=YELLOW_E,
            fill_color=YELLOW_E,
            fill_opacity=0.22,
            stroke_width=0
        ).move_to(cell_center)

        arrow_cyto = Arrow(
            start=np.array([1.3, -0.45, 0]),
            end=np.array([-0.3, -0.45, 0]),
            buff=0.08,
            color=YELLOW_C,
            stroke_width=2.5,
            max_tip_length_to_length_ratio=0.25
        )
        lbl_cyto = Text("Cytoplasm", font_size=20, color=YELLOW_C).next_to(arrow_cyto, RIGHT, buff=0.15)

        self.play(
            ReplacementTransform(cyto_seed, cytoplasm),
            Create(arrow_cyto),
            Write(lbl_cyto),
            run_time=1.0
        )

        chloro1 = Ellipse(
            width=0.65,
            height=0.35,
            color=GREEN_B,
            fill_color=GREEN_E,
            fill_opacity=0.85,
            stroke_width=2
        ).move_to(cell_center + np.array([0.6, -0.9, 0]))
        chloro2 = Ellipse(
            width=0.65,
            height=0.35,
            color=GREEN_B,
            fill_color=GREEN_E,
            fill_opacity=0.85,
            stroke_width=2
        ).move_to(cell_center + np.array([-0.7, -1.1, 0]))
        chloroplasts = VGroup(chloro1, chloro2)

        arrow_chloro = Arrow(
            start=np.array([1.3, -1.1, 0]),
            end=chloro1.get_right(),
            buff=0.08,
            color=GREEN_B,
            stroke_width=2.5,
            max_tip_length_to_length_ratio=0.25
        )
        lbl_chloro = Text("Chloroplast", font_size=20, color=GREEN_B).next_to(arrow_chloro, RIGHT, buff=0.15)

        self.play(
            FadeIn(chloroplasts, scale=0.7),
            Create(arrow_chloro),
            Write(lbl_chloro),
            run_time=1.0
        )

        self.wait(1.5)