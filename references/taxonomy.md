# ABCD Taxonomy

This file defines the categories, the severity scale, and the strictness levels. Apply these definitions rather than improvising, so results stay consistent across runs and across assets.

## Categories

Keep the framing clinical and professional. These describe accidental visual resemblance in design work, not intentional adult content.

### phallic
A form that reads as a penis or a penis-and-testicles shape. Common accidental sources:
- An elongated vertical or diagonal element with a rounded or domed top.
- A pair of rounded forms at the base of an elongated element.
- Negative space between two columns or figures that resolves into the shape.
- Rockets, towers, bottles, vegetables, tools, and mascots are frequent offenders.

### vulvar
A form that reads as a vulva. Common accidental sources:
- A vertical almond or leaf shape (a mandorla) with internal division or a central line.
- Two symmetrical curves meeting top and bottom around a central gap.
- Petals, fruit cross-sections, cupped hands, and split ovals.

### breast
A form that reads as breasts. Common accidental sources:
- Paired rounded forms of similar size set side by side, often with a central point or nipple-like detail.
- Two circles or domes with small central marks.
- Hills, bubbles, paired fruit, and rounded paired icons.

## Severity scale

Severity is about how strongly and how unavoidably the resemblance reads, not about how rude the body part is.

- **high**: An outside viewer would likely see it immediately, even without looking for it. This is the kind of thing that ends up screenshotted and shared. Recommend hold.
- **medium**: A viewer could readily see it once their attention lands there, or once the image is rotated, scaled down, or seen in passing. Worth fixing. Recommend review.
- **low**: A faint or conditional resemblance that needs the wrong angle, a mirror, or a suggestible viewer. Note it so the designer is aware, but it may be acceptable. Recommend review.

## Confidence

Confidence (0.0 to 1.0) is separate from severity. Severity is how bad it is if real. Confidence is how sure you are it is there at all. A faint shape you are certain about is low severity, high confidence. A strong shape you are unsure about is high severity, lower confidence. Report both honestly.

## Strictness levels

Strictness shifts the flagging threshold. It does not change the category definitions above.

- **low**: Flag only strong, hard-to-miss resemblance. Mostly high-severity flags get through. Fewest false positives. Good for a final gut check.
- **medium (default)**: Flag clear resemblance and the more readable borderline cases. Skip faint coincidences. The everyday setting.
- **high**: Flag subtle and conditional cases too, including shapes that only appear when rotated or mirrored. The most cautious pass, the most false positives. Good for high-stakes assets headed to a wide public audience.

Always state which strictness level a result used. Never describe strictness in terms of specific countries or cultures, since that bakes in stereotypes. A market-specific request is handled as a strictness choice plus any concrete concerns the user names.
