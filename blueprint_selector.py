def select_blueprint(total_marks, bloom_distribution, question_types):
    """
    Blueprint Selector — distributes marks across
    Bloom's levels and question types mathematically.

    Args:
        total_marks       : int   — e.g. 100
        bloom_distribution: dict  — e.g. {'remember':20, 'understand':20, ...}
        question_types    : list  — e.g. ['mcq', 'short', 'long']

    Returns:
        blueprint: list of dicts — each dict = one question slot
    """

    # Marks per question type
    MARKS_MAP = {
        'mcq':   2,
        'tf':    1,
        'fill':  2,
        'short': 5,
        'long':  10
    }

    # How many questions per type (priority order)
    TYPE_COUNT = {
        'mcq':   3,
        'tf':    2,
        'fill':  2,
        'short': 2,
        'long':  1
    }

    blueprint = []
    question_num = 1

    for level, pct in bloom_distribution.items():
        if pct == 0:
            continue

        # Marks budget for this Bloom level
        level_marks = round((pct / 100) * total_marks)
        spent = 0

        for qtype in question_types:
            if spent >= level_marks:
                break

            marks_per_q = MARKS_MAP.get(qtype, 2)
            count       = TYPE_COUNT.get(qtype, 1)

            for _ in range(count):
                if spent + marks_per_q > level_marks:
                    break

                blueprint.append({
                    'num'   : question_num,
                    'type'  : qtype,
                    'level' : level,
                    'marks' : marks_per_q
                })

                spent        += marks_per_q
                question_num += 1

    return blueprint


def validate_blueprint(blueprint, total_marks):
    """
    Checks if total marks in blueprint match expected total.
    Returns (is_valid, actual_total)
    """
    actual = sum(q['marks'] for q in blueprint)
    return (actual == total_marks, actual)


def get_bloom_summary(blueprint):
    """
    Returns how many questions per Bloom level — for analytics.
    """
    summary = {}
    for q in blueprint:
        summary[q['level']] = summary.get(q['level'], 0) + 1
    return summary


# ── Quick Test ──
if __name__ == "__main__":
    bloom = {
        'remember'  : 20,
        'understand': 20,
        'apply'     : 20,
        'analyze'   : 15,
        'evaluate'  : 15,
        'create'    : 10
    }
    types = ['mcq', 'short', 'long']

    bp = select_blueprint(100, bloom, types)

    print(f"Total questions : {len(bp)}")
    print(f"Total marks     : {sum(q['marks'] for q in bp)}")
    print(f"Bloom summary   : {get_bloom_summary(bp)}")
    print()
    for q in bp:
        print(f"  Q{q['num']:02d} | {q['type']:6s} | {q['level']:12s} | {q['marks']}M")