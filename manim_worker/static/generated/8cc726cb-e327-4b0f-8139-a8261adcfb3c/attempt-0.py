from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        # Define triangle vertices for a 3-4-5 right triangle
        # The right angle is at pA
        pA = 2 * LEFT + DOWN
        pB = 2 * RIGHT + DOWN
        pC = 2 * LEFT + 2 * UP

        # Create the right triangle
        triangle = Polygon(pA, pB, pC, color=WHITE, stroke_width=4)

        # Create square on side AB (length 4)
        # Vector from pA to pB is 4*RIGHT. Outward normal is 4*DOWN.
        square_4 = Polygon(pA, pB, pB + 4 * DOWN, pA + 4 * DOWN,
                           color=BLUE, fill_opacity=0.4, stroke_width=3)
        area_4_text = MathTex("16", color=BLUE_A).move_to(square_4.get_center())

        # Create square on side AC (length 3)
        # Vector from pA to pC is 3*UP. Outward normal is 3*LEFT.
        square_3 = Polygon(pA, pC, pC + 3 * LEFT, pA + 3 * LEFT,
                           color=GREEN, fill_opacity=0.4, stroke_width=3)
        area_3_text = MathTex("9", color=GREEN_A).move_to(square_3.get_center())

        # Create square on side BC (hypotenuse, length 5)
        # Vector from pB to pC is (-4*RIGHT) + (3*UP).
        vec_BC = pC - pB
        # Outward normal vector of length 5: Rotate vec_BC by PI/2 (counter-clockwise).
        # For a vector (x,y), rotation by PI/2 gives (-y,x).
        # vec_BC is (-4, 3). Rotated is (-3, -4).
        perp_vec_outward = normalize(rotate_vector(vec_BC, PI/2)) * 5
        
        square_5 = Polygon(pB, pC, pC + perp_vec_outward, pB + perp_vec_outward,
                           color=RED, fill_opacity=0.4, stroke_width=3)
        area_5_text = MathTex("25", color=RED_A).move_to(square_5.get_center())

        # Animate drawing the triangle
        self.play(Create(triangle), run_time=1.0)

        # Animate drawing the squares
        self.play(
            Create(square_3),
            Create(square_4),
            Create(square_5),
            run_time=1.5
        )

        # Animate showing the areas
        self.play(
            FadeIn(area_3_text, shift=DOWN * 0.5),
            FadeIn(area_4_text, shift=DOWN * 0.5),
            FadeIn(area_5_text, shift=DOWN * 0.5),
            run_time=1.0
        )
        self.wait(0.3)

        # Highlight areas to illustrate 9 + 16 = 25
        self.play(
            VGroup(square_3, area_3_text, square_4, area_4_text).animate.set_color(YELLOW_C),
            run_time=0.8
        )
        self.play(
            VGroup(square_5, area_5_text).animate.set_color(ORANGE_C),
            run_time=0.8
        )
        self.wait(0.3)
        # Revert colors
        self.play(
            VGroup(square_3, area_3_text).animate.set_color(GREEN),
            VGroup(square_4, area_4_text).animate.set_color(BLUE),
            VGroup(square_5, area_5_text).animate.set_color(RED),
            run_time=0.8
        )
        
        # Prepare the final Pythagorean equation
        pythagorean_equation = MathTex("a^2 + b^2 = c^2", color=YELLOW)
        pythagorean_equation.next_to(VGroup(triangle, square_3, square_4, square_5), DOWN, buff=1.0)

        # Fade out current elements and write the equation
        self.play(
            FadeOut(VGroup(triangle, square_3, square_4, square_5, area_3_text, area_4_text, area_5_text), scale=0.8),
            Write(pythagorean_equation),
            run_time=1.5
        )
        self.wait()