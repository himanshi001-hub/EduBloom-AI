from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer,
    Table, TableStyle, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import os
 
 
# Bloom level badge colors
BLOOM_COLORS = {
    'remember'  : colors.HexColor('#ef4444'),
    'understand': colors.HexColor('#f59e0b'),
    'apply'     : colors.HexColor('#10b981'),
    'analyze'   : colors.HexColor('#3b82f6'),
    'evaluate'  : colors.HexColor('#8b5cf6'),
    'create'    : colors.HexColor('#f43f5e'),
}
 
 
def create_pdf(
    question_list,
    output_path   = "question_paper.pdf",
    exam_title    = "Examination 2025",
    subject       = "General",
    grade         = "Grade 10",
    school        = "",
    total_marks   = 100,
    duration      = 180,
    difficulty    = "Medium",
    include_answers = True,
    show_bloom_tags = True
):
    """
    Converts a list of question dicts into a formatted PDF.
 
    Each question dict should have:
        num, text, type, level, marks,
        option_a/b/c/d (for MCQ), correct_answer
 
    Returns: output_path (str)
    """
 
    doc = SimpleDocTemplate(
        output_path,
        pagesize    = A4,
        rightMargin = 2 * cm,
        leftMargin  = 2 * cm,
        topMargin   = 2 * cm,
        bottomMargin= 2 * cm
    )
 
    styles  = getSampleStyleSheet()
    story   = []
 
    # ── Custom Styles ──
    title_style = ParagraphStyle(
        'Title',
        parent    = styles['Heading1'],
        fontSize  = 16,
        alignment = TA_CENTER,
        spaceAfter= 4,
        fontName  = 'Helvetica-Bold'
    )
    school_style = ParagraphStyle(
        'School',
        parent    = styles['Normal'],
        fontSize  = 13,
        alignment = TA_CENTER,
        fontName  = 'Helvetica-Bold',
        spaceAfter= 2
    )
    meta_style = ParagraphStyle(
        'Meta',
        parent    = styles['Normal'],
        fontSize  = 9,
        alignment = TA_CENTER,
        textColor = colors.HexColor('#555555'),
        spaceAfter= 6
    )
    instr_style = ParagraphStyle(
        'Instr',
        parent    = styles['Normal'],
        fontSize  = 8.5,
        spaceAfter= 2,
        leftIndent= 10
    )
    section_style = ParagraphStyle(
        'Section',
        parent      = styles['Normal'],
        fontSize    = 10,
        fontName    = 'Helvetica-Bold',
        spaceAfter  = 6,
        spaceBefore = 10,
        textColor   = colors.HexColor('#7c3aed'),
        borderPad   = 4
    )
    q_style = ParagraphStyle(
        'Question',
        parent    = styles['Normal'],
        fontSize  = 10,
        spaceAfter= 3,
        leftIndent= 0
    )
    opt_style = ParagraphStyle(
        'Option',
        parent    = styles['Normal'],
        fontSize  = 9.5,
        leftIndent= 20,
        spaceAfter= 1
    )
    ans_style = ParagraphStyle(
        'Answer',
        parent    = styles['Normal'],
        fontSize  = 9,
        textColor = colors.HexColor('#1d4ed8'),
        leftIndent= 20,
        spaceAfter= 2
    )
 
    # ── Header ──
    if school:
        story.append(Paragraph(school, school_style))
 
    story.append(Paragraph(exam_title, title_style))
 
    from datetime import date
    today = date.today().strftime("%d %B %Y")
 
    story.append(Paragraph(
        f"Subject: <b>{subject}</b> &nbsp;&nbsp; Class: <b>{grade}</b> &nbsp;&nbsp; "
        f"Total Marks: <b>{total_marks}</b> &nbsp;&nbsp; Time: <b>{duration} min</b> &nbsp;&nbsp; "
        f"Difficulty: <b>{difficulty}</b> &nbsp;&nbsp; Date: <b>{today}</b>",
        meta_style
    ))
 
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.black))
    story.append(Spacer(1, 6))
 
    # ── Instructions ──
    story.append(Paragraph("<b>General Instructions:</b>", instr_style))
    instructions = [
        "1. All questions are compulsory unless stated otherwise.",
        "2. Read all questions carefully before answering.",
        "3. Marks are indicated in brackets [ ] against each question.",
        "4. Write neatly and show all working where applicable.",
    ]
    for ins in instructions:
        story.append(Paragraph(ins, instr_style))
 
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    story.append(Spacer(1, 8))
 
    # ── Group questions by type for sections ──
    SECTION_NAMES = {
        'mcq'  : 'Section A — Multiple Choice Questions',
        'tf'   : 'Section B — True or False',
        'fill' : 'Section C — Fill in the Blanks',
        'short': 'Section D — Short Answer Questions',
        'long' : 'Section E — Long Answer Questions',
    }
 
    grouped = {}
    for q in question_list:
        grouped.setdefault(q['type'], []).append(q)
 
    # ── Render each section ──
    for qtype, sec_title in SECTION_NAMES.items():
        qs = grouped.get(qtype, [])
        if not qs:
            continue
 
        story.append(Paragraph(sec_title, section_style))
        story.append(HRFlowable(
            width="100%", thickness=0.5,
            color=colors.HexColor('#7c3aed')
        ))
        story.append(Spacer(1, 4))
 
        for q in qs:
            bloom_tag = (
                f' <font size="7" color="{BLOOM_COLORS.get(q["level"], colors.grey).hexval()}">'
                f'[{q["level"].capitalize()}]</font>'
            ) if show_bloom_tags else ''
 
            q_text = (
                f'<b>Q{q["num"]}.</b> {q["text"]}{bloom_tag} '
                f'<b>[{q["marks"]} Mark{"s" if q["marks"] > 1 else ""}]</b>'
            )
            story.append(Paragraph(q_text, q_style))
 
            # MCQ options
            if qtype == 'mcq':
                for opt_key in ['option_a', 'option_b', 'option_c', 'option_d']:
                    opt_val = q.get(opt_key, '')
                    if opt_val:
                        story.append(Paragraph(opt_val, opt_style))
 
            # Answer lines for short/long
            if qtype in ('short', 'long'):
                lines = 3 if qtype == 'short' else 7
                for _ in range(lines):
                    story.append(Paragraph(
                        '_' * 85,
                        ParagraphStyle('line', fontSize=8, spaceAfter=4, textColor=colors.lightgrey)
                    ))
 
            story.append(Spacer(1, 6))
 
    # ── Answer Key ──  ✅ FIX: removed dashArray=(4, 2) — not supported in this ReportLab version
    if include_answers:
        story.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
        story.append(Spacer(1, 8))
        story.append(Paragraph("<b>— Answer Key —</b>", section_style))
 
        for q in question_list:
            if q['type'] in ('mcq', 'tf', 'fill'):
                ans_text = f"Q{q['num']}: {q.get('correct_answer', 'See marking scheme')}"
            else:
                ans_text = f"Q{q['num']}: [Model answer — refer marking scheme]"
            story.append(Paragraph(ans_text, ans_style))
 
    # ── Footer note ──
    story.append(Spacer(1, 16))
    story.append(Paragraph(
        "<i>Generated by QuestionAI — AI-Powered Exam Platform</i>",
        ParagraphStyle('footer', fontSize=7.5, textColor=colors.grey, alignment=TA_CENTER)
    ))
 
    # ── Build PDF ──
    doc.build(story)
    print(f"✅ PDF saved: {output_path}")
    return output_path
 
 
# ── Quick Test ──
if __name__ == "__main__":
    sample_questions = [
        { 'num':1, 'text':'What is the powerhouse of the cell?', 'type':'mcq',
          'level':'remember', 'marks':2,
          'option_a':'(a) Nucleus', 'option_b':'(b) Mitochondria',
          'option_c':'(c) Ribosome', 'option_d':'(d) Chloroplast',
          'correct_answer':'(b) Mitochondria' },
 
        { 'num':2, 'text':'State True or False: Plants perform photosynthesis.',
          'type':'tf', 'level':'remember', 'marks':1,
          'correct_answer':'True' },
 
        { 'num':3, 'text':'The process of water turning to vapour is called ________.',
          'type':'fill', 'level':'understand', 'marks':2,
          'correct_answer':'Evaporation' },
 
        { 'num':4, 'text':'Explain the difference between aerobic and anaerobic respiration.',
          'type':'short', 'level':'understand', 'marks':5,
          'correct_answer':'Aerobic uses O2 and gives more ATP; anaerobic does not use O2.' },
 
        { 'num':5, 'text':'Design an experiment to test the effect of light on photosynthesis rate.',
          'type':'long', 'level':'create', 'marks':10,
          'correct_answer':'[Detailed experimental design with variables, procedure, expected results]' },
    ]
 
    create_pdf(
        sample_questions,
        output_path     = "test_paper.pdf",
        exam_title      = "Biology Unit Test 1",
        subject         = "Biology",
        grade           = "Grade 11",
        school          = "St. Xavier's High School",
        total_marks     = 20,
        duration        = 60,
        difficulty      = "Medium",
        include_answers = True,
        show_bloom_tags = True
    )