# Pre-judged choices written by the Lead (Claude, in a Claude Code session) following prompts/judge.v1,
# because no GAME_ANTHROPIC_API_KEY exists yet. Replace with `pnpm tsx scripts/prejudge-choices.ts --force`
# once a key is available. Run: python3 scripts/prejudge-manual/lead-2026-10-23.py
# Rules applied: level 2-3 only with an evidence id from the choice whose indicator and direction match;
# every positive effect has a cost; preset specificity at most 3; consistency 3 (no history at pre-judge time).
import json, os
from collections import defaultdict

MODEL = "claude (Lead, Claude Code session) — manual pre-judge, not the API pipeline"
PROMPT = "judge.v1"
CREATED = "2026-10-23"

def E(t, d, lvl, start=0, lasts=4, ev=(), note=""):
    return {"indicator": t, "direction": d, "level": str(lvl), "start_after_quarters": start,
            "lasts_quarters": lasts, "note": note, "evidence_ids": list(ev)}

def G(g, d, lvl, reason):
    return {"group": g, "direction": d, "level": str(lvl), "reason": reason}

def A(title, cost, rec="none", dur=4, leg=False, risk="none", eff=(), grp=(), side=()):
    return {"title": title, "cost_size": cost, "recurring_cost_size": rec, "duration_quarters": dur,
            "requires_legislation": leg, "legal_risk": risk, "effects": list(eff),
            "group_impacts": list(grp), "side_effects": list(side)}

def J(rel, feas, spec, trade, cov, interp, actions, cons=3, flags=None):
    f = {"impossible_claim": False, "cruelty": False, "rights_violation": False, "unconstitutional": False}
    f.update(flags or {})
    return {"input_class": "normal", "interpretation": interp, "actions": actions, "overreach": False,
            "scores": {"relevance": str(rel), "feasibility": str(feas), "specificity": str(spec),
                       "tradeoffs": str(trade), "consistency": str(cons)},
            "event_coverage": str(cov), "flags": f, "follow_up_hooks": []}

P = {}

# ---- disaster.drought.severe ----
P["disaster.drought.severe"] = {
 "a": J(4, 4, 3, 3, 2, "จ้างงานสาธารณะและแจกอาหารในพื้นที่แล้ง", [A("จ้างงานสาธารณะและแจกอาหาร", "L", dur=4,
      eff=[E("group:farmers", "up", 2, 0, 4, ["ev.drought.002"], "ตาข่ายรองรับลดผลกระทบต่ออาหารของครัวเรือน"),
           E("inequality", "down", 2, 1, 6, ["ev.public-works.001"], "งานสาธารณะเพิ่มรายได้ครัวเรือนยากจน")],
      grp=[G("farmers", "up", 2, "มีรายได้และอาหารช่วงแล้ง"), G("urban", "down", 1, "ภาษีจากเมืองถูกใช้มาก")],
      side=[E("budget", "down", 1, 0, 4, note="ต้องจ้างเจ้าหน้าที่ดูแลทั่วพื้นที่")])]),
 "b": J(3, 4, 3, 2, 1, "อุดหนุนประกันภัยพืชผลตามดัชนีฝน", [A("อุดหนุนประกันภัยตามดัชนีฝน", "M", rec="S", dur=8,
      eff=[E("group:farmers", "up", 2, 1, 8, ["ev.drought.001"], "ประกันทำให้เกษตรกรกล้าลงทุนมากขึ้น"),
           E("gdpGrowth", "up", 1, 2, 8, note="การลงทุนในฟาร์มเพิ่มขึ้นเล็กน้อย")],
      grp=[G("farmers", "up", 1, "ได้ความคุ้มครองในอนาคต"), G("business", "up", 1, "ตลาดประกันขยาย")],
      side=[E("group:farmers", "down", 1, 0, 2, note="ผู้ที่เสียหายแล้วไม่ได้รับความช่วยเหลือทันที")])]),
 "c": J(4, 4, 3, 2, 2, "โอนเงินสดให้เกษตรกรรายย่อยที่ขึ้นทะเบียน", [A("โอนเงินสดเกษตรกรรายย่อย", "M", dur=2,
      eff=[E("gdpGrowth", "up", 1, 0, 3, ["ev.cash-transfer.001"], "เงินหมุนในเศรษฐกิจท้องถิ่น"),
           E("group:farmers", "up", 1, 0, 2, note="เงินถึงมือเร็ว")],
      grp=[G("farmers", "up", 2, "ได้เงินสดตรง"), G("urban", "down", 1, "ผู้เสียภาษีในเมืองรับภาระ")],
      side=[E("stability", "down", 1, 0, 2, note="ผู้ไม่ได้ขึ้นทะเบียนตกหล่นและร้องเรียน")])]),
}

# ---- disaster.flood.major ----
P["disaster.flood.major"] = {
 "a": J(4, 4, 3, 2, 2, "จ้างคนในพื้นที่ซ่อมสร้างโครงสร้างพื้นฐาน", [A("จ้างงานฟื้นฟูและซ่อมสร้าง", "L", dur=8,
      eff=[E("inequality", "down", 2, 1, 8, ["ev.public-works.001"], "งานสาธารณะเพิ่มรายได้ครัวเรือนยากจน"),
           E("gdpGrowth", "up", 1, 2, 8, note="โครงสร้างพื้นฐานกลับมาใช้งานได้")],
      grp=[G("farmers", "up", 1, "มีงานและคันกั้นน้ำ"), G("youth", "up", 1, "มีงานในพื้นที่")],
      side=[E("debt", "up", 1, 0, 8, note="ใช้งบสูงและใช้เวลานาน")])]),
 "b": J(4, 4, 3, 3, 2, "จ่ายเงินสดเฉพาะครัวเรือนที่เสียหาย", [A("เงินช่วยเหลือครัวเรือนที่เสียหาย", "M", dur=2,
      eff=[E("gdpGrowth", "up", 1, 0, 3, ["ev.cash-transfer.001"], "เงินหมุนในตลาดท้องถิ่น"),
           E("health", "up", 1, 0, 2, note="ครัวเรือนฟื้นตัวเร็วขึ้น")],
      grp=[G("farmers", "up", 2, "ได้เงินชดเชยตรง"), G("urban", "up", 1, "ครัวเรือนในเมืองที่เสียหายได้รับด้วย")],
      side=[E("stability", "down", 1, 0, 2, note="ผู้ตกสำรวจไม่พอใจ")])]),
 "c": J(2, 4, 3, 1, 1, "ปล่อยให้ตลาดและประกันภัยฟื้นตัวเอง", [A("สินเชื่อดอกเบี้ยต่ำและเร่งจ่ายประกัน", "S", dur=4,
      eff=[E("gdpGrowth", "up", 1, 1, 4, ["ev.flood.001"], "กิจกรรมเศรษฐกิจมักฟื้นภายในไม่กี่ปี")],
      grp=[G("business", "up", 1, "ได้สินเชื่อและเงินประกันเร็ว"), G("farmers", "down", 2, "ผู้ไม่มีประกันแบกภาระเอง")],
      side=[E("inequality", "up", 1, 0, 6, note="ครัวเรือนยากจนฟื้นตัวช้ากว่า")])]),
}

# ---- economy.currency.crash ----
P["economy.currency.crash"] = {
 "a": J(3, 2, 3, 1, 1, "ใช้ทุนสำรองพยุงค่าเงินและคุมราคา", [A("ขายทุนสำรองและตั้งเพดานราคา", "L", dur=2, leg=True, risk="low",
      eff=[E("inflation", "down", 1, 0, 2, note="ชะลอราคาสินค้านำเข้าได้ระยะสั้น")],
      grp=[G("urban", "up", 1, "ราคาสินค้าจำเป็นไม่ขึ้นทันที"), G("business", "down", 1, "เพดานราคากดกำไร")],
      side=[E("gdpGrowth", "down", 1, 2, 4, note="สินค้าอาจขาดตลาดเมื่อทุนสำรองหมด"),
            E("debt", "up", 1, 0, 4, note="ทุนสำรองลดลง")])]),
 "b": J(4, 4, 3, 2, 2, "ปล่อยค่าเงินลอยตัวและขึ้นดอกเบี้ย", [A("ลอยตัวค่าเงินและขึ้นดอกเบี้ย", "S", dur=4,
      eff=[E("inflation", "down", 1, 1, 4, note="ดอกเบี้ยสูงช่วยคุมเงินเฟ้อระยะกลาง")],
      grp=[G("business", "down", 1, "ต้นทุนกู้ยืมสูงขึ้น"), G("urban", "down", 1, "ผู้กู้และค่าครองชีพ")],
      side=[E("inflation", "up", 1, 0, 2, ["ev.currency.001"], "ราคาสินค้านำเข้าแพงขึ้นตามค่าเงิน"),
            E("gdpGrowth", "down", 1, 0, 4, note="ดอกเบี้ยสูงชะลอการลงทุน")])]),
 "c": J(3, 4, 3, 3, 1, "เงินสดคนรายได้น้อยและค้ำสินเชื่อผู้ส่งออก", [A("โอนเงินสดและค้ำประกันสินเชื่อ", "M", dur=4,
      eff=[E("group:urban", "up", 1, 0, 4, note="ประคองครัวเรือนเปราะบาง"),
           E("gdpGrowth", "up", 1, 0, 4, note="ผู้ส่งออกมีเงินทุนหมุนเวียน")],
      grp=[G("business", "up", 1, "ผู้ส่งออกได้สินเชื่อ"), G("farmers", "up", 1, "ครัวเรือนรายได้น้อยได้เงิน")],
      side=[E("debt", "up", 1, 0, 4, note="ไม่แก้ต้นเหตุและเพิ่มภาระงบ")])]),
}

# ---- economy.oil.spike ----
P["economy.oil.spike"] = {
 "a": J(4, 4, 3, 1, 2, "ตรึงราคาน้ำมันด้วยเงินอุดหนุนทั่วไป", [A("อุดหนุนราคาน้ำมันทั่วไป", "L", rec="M", dur=4,
      eff=[E("inflation", "down", 1, 0, 4, note="ราคาหน้าปั๊มคงที่")],
      grp=[G("urban", "up", 2, "ค่าครองชีพไม่ขึ้น"), G("business", "up", 1, "ต้นทุนขนส่งคงที่")],
      side=[E("budget", "down", 2, 0, 4, ["ev.fuel-subsidy.001"], "อุดหนุนพลังงานทั่วไปกดดันงบประมาณ"),
            E("inequality", "up", 2, 0, 4, ["ev.fuel-subsidy.002"], "ประโยชน์ส่วนใหญ่ตกกับผู้มีรายได้สูง")])]),
 "b": J(3, 4, 3, 1, 1, "ปล่อยราคาน้ำมันลอยตัวตามตลาด", [A("ปล่อยราคาลอยตัว", "XS", dur=2,
      eff=[E("budget", "up", 1, 0, 4, note="รัฐไม่ต้องใช้เงินอุดหนุน")],
      grp=[G("urban", "down", 2, "ค่าครองชีพพุ่ง"), G("farmers", "down", 1, "ต้นทุนการผลิตสูงขึ้น")],
      side=[E("inflation", "up", 1, 0, 3, note="ต้นทุนขนส่งส่งต่อไปที่ราคาสินค้า")])]),
 "c": J(4, 4, 3, 3, 2, "ลอยตัวราคาแต่โอนเงินให้ครัวเรือนรายได้น้อย", [A("ลอยตัวพร้อมโอนเงินเฉพาะกลุ่ม", "M", dur=4,
      eff=[E("gdpGrowth", "up", 1, 0, 3, ["ev.cash-transfer.001"], "เงินโอนช่วยพยุงการใช้จ่าย"),
           E("inequality", "down", 1, 0, 4, note="ช่วยคนรายได้น้อยตรงจุด")],
      grp=[G("farmers", "up", 1, "ครัวเรือนรายได้น้อยได้เงินชดเชย"), G("urban", "down", 1, "ชนชั้นกลางไม่ได้รับความช่วยเหลือ")],
      side=[E("inflation", "up", 1, 0, 2, note="ราคาน้ำมันยังส่งผ่านไปที่ราคาสินค้า")])]),
}

# ---- foreign.tariff.raised ----
P["foreign.tariff.raised"] = {
 "a": J(3, 4, 3, 1, 1, "ขึ้นภาษีตอบโต้สินค้านำเข้า", [A("ภาษีตอบโต้", "S", dur=4, leg=True,
      eff=[E("group:business", "up", 1, 0, 2, note="ผู้ผลิตบางรายได้รับการปกป้อง")],
      grp=[G("urban", "down", 1, "ราคาสินค้านำเข้าสูงขึ้น"), G("business", "down", 1, "ต้นทุนวัตถุดิบสูงขึ้น")],
      side=[E("inflation", "up", 2, 0, 4, ["ev.tariff.001"], "ภาษีถูกส่งผ่านไปที่ราคาในประเทศเกือบทั้งหมด"),
            E("gdpGrowth", "down", 2, 1, 4, ["ev.tariff.002"], "ผู้ซื้อสินค้านำเข้าเสียหายสุทธิ"),
            E("foreignRelations", "down", 1, 0, 4, note="ความขัดแย้งทางการค้ายืดเยื้อ")])]),
 "b": J(4, 4, 3, 2, 2, "เจรจาและกระจายตลาดส่งออก", [A("เจรจาและหาตลาดใหม่", "S", dur=6,
      eff=[E("foreignRelations", "up", 1, 0, 6, note="รักษาความสัมพันธ์กับคู่ค้า"),
           E("gdpGrowth", "up", 1, 3, 6, note="ตลาดใหม่ช่วยในระยะต่อไป")],
      grp=[G("business", "down", 1, "ต้องรับผลกระทบระหว่างรอผล"), G("farmers", "down", 1, "ราคาสินค้าส่งออกตก")])]),
 "c": J(3, 4, 3, 3, 1, "ช่วยเหลือชั่วคราวผู้ส่งออกที่ได้รับผลกระทบ", [A("สินเชื่อและเงินชดเชยผู้ส่งออก", "M", dur=4,
      eff=[E("unemployment", "down", 1, 0, 4, note="ประคองการจ้างงานในภาคส่งออก")],
      grp=[G("business", "up", 1, "ผู้ส่งออกได้เงินทุน"), G("farmers", "up", 1, "เกษตรกรที่เสียตลาดได้ชดเชย"),
           G("urban", "down", 1, "รู้สึกว่าไม่เป็นธรรม")],
      side=[E("budget", "down", 1, 0, 4, note="ใช้งบรัฐ")])]),
}

# ---- health.epidemic.outbreak ----
P["health.epidemic.outbreak"] = {
 "a": J(4, 3, 3, 1, 3, "ปิดเมืองและจำกัดการเดินทาง", [A("ปิดสถานที่เสี่ยงและจำกัดการเดินทาง", "L", dur=2, leg=True, risk="medium",
      eff=[E("health", "up", 1, 0, 2, note="ลดการแพร่ระยะสั้น")],
      grp=[G("business", "down", 2, "ร้านค้ารายเล็กขาดรายได้"), G("youth", "down", 1, "งานรายวันหายไป"),
           G("urban", "down", 1, "ชีวิตประจำวันหยุดชะงัก")],
      side=[E("gdpGrowth", "down", 1, 0, 2, note="การใช้จ่ายลดลง ส่วนหนึ่งลดเองก่อนมีคำสั่ง")])]),
 "b": J(4, 4, 3, 3, 2, "แจกหน้ากากและรณรงค์ล้างมือในชุมชน", [A("หน้ากากฟรีและรณรงค์ผ่านผู้นำชุมชน", "S", dur=3,
      eff=[E("health", "up", 2, 0, 3, ["ev.epidemic.001", "ev.epidemic.002"], "หน้ากากร่วมการรณรงค์และการล้างมือลดการติดเชื้อ")],
      grp=[G("urban", "up", 1, "เศรษฐกิจยังเปิด"), G("farmers", "up", 1, "ชุมชนได้หน้ากากฟรี")],
      side=[E("health", "down", 1, 1, 2, note="ผลขึ้นกับการทำตามของประชาชน")])]),
 "c": J(2, 5, 2, 1, 1, "แนะนำให้ระวังตัวและเปิดเศรษฐกิจตามปกติ", [A("คำแนะนำโดยสมัครใจ", "XS", dur=2,
      eff=[E("group:business", "up", 1, 0, 2, note="กิจการเปิดได้ตามปกติ")],
      grp=[G("business", "up", 1, "ไม่มีคำสั่งปิด"), G("urban", "down", 1, "ผู้สูงอายุและผู้ป่วยเสี่ยงสูง")],
      side=[E("health", "down", 1, 0, 3, note="โรคอาจแพร่เร็วขึ้น"),
            E("gdpGrowth", "down", 1, 1, 2, ["ev.epidemic.003"], "คนลดการออกจากบ้านเองแม้ไม่มีคำสั่ง")])]),
}

# ---- health.hospitals.overwhelmed ----
P["health.hospitals.overwhelmed"] = {
 "a": J(5, 3, 3, 2, 3, "เพิ่มเตียงและจ้างบุคลากรชั่วคราว", [A("โรงพยาบาลสนามและบุคลากรเพิ่ม", "L", rec="S", dur=4,
      eff=[E("health", "up", 1, 0, 4, note="ลดความแออัดโดยตรง ยังไม่มีหลักฐานในคลังว่าขยายเตียงช่วยมากแค่ไหน")],
      grp=[G("urban", "up", 1, "รอคิวน้อยลง"), G("youth", "up", 1, "มีงานชั่วคราวด้านสาธารณสุข")],
      side=[E("budget", "down", 1, 0, 4, note="หาบุคลากรมีทักษะได้ไม่ทัน")])]),
 "b": J(4, 4, 3, 3, 2, "ส่งต่อผู้ป่วยวิกฤตและจ่ายค่ารักษาฉุกเฉินแทน", [A("ส่งต่อผู้ป่วยและยกเว้นค่ารักษาฉุกเฉิน", "M", rec="S", dur=4,
      eff=[E("health", "up", 1, 0, 4, ["ev.hospital.002"], "การยกเว้นค่าธรรมเนียมเพิ่มการใช้บริการ ผลต่อสุขภาพยังไม่ชัด")],
      grp=[G("urban", "up", 1, "เข้าถึงการรักษาฉุกเฉิน"), G("business", "up", 1, "โรงพยาบาลเอกชนได้รายได้")],
      side=[E("budget", "down", 1, 0, 4, note="ค่าใช้จ่ายสูงต่อเนื่อง")])]),
 "c": J(2, 5, 2, 1, 1, "ปล่อยให้ผู้ที่จ่ายไหวใช้บริการเอกชน", [A("ไม่ลงทุนเพิ่ม", "XS", dur=2,
      eff=[E("budget", "up", 1, 0, 2, note="ไม่ใช้งบเพิ่ม")],
      grp=[G("urban", "down", 2, "ผู้มีรายได้น้อยรักษาไม่ทัน"), G("business", "up", 1, "เอกชนได้ลูกค้าเพิ่ม")],
      side=[E("health", "down", 2, 0, 4, ["ev.hospital.001"], "โรงพยาบาลแออัดสัมพันธ์กับการเสียชีวิตเกินที่มากขึ้น"),
            E("inequality", "up", 1, 0, 4, note="คนจนเข้าถึงการรักษาน้อยลง")])]),
}

# ---- health.vaccination.decline ----
P["health.vaccination.decline"] = {
 "a": J(5, 4, 3, 3, 3, "หน่วยฉีดวัคซีนเคลื่อนที่ตามนัดทุกเดือน", [A("หน่วยฉีดวัคซีนเคลื่อนที่รายเดือน", "M", rec="S", dur=8,
      eff=[E("health", "up", 2, 1, 8, ["ev.immunization.001"], "ค่ายฉีดวัคซีนสม่ำเสมอเพิ่มความครอบคลุมชัดเจน")],
      grp=[G("farmers", "up", 1, "เข้าถึงวัคซีนใกล้บ้าน"), G("youth", "up", 1, "ลูกได้วัคซีนครบ")],
      side=[E("budget", "down", 1, 0, 8, note="ต้องจ้างบุคลากรและรถเพิ่ม")])]),
 "b": J(4, 4, 3, 3, 2, "ให้ของจูงใจครอบครัวที่พาเด็กมาฉีดครบ", [A("ของจูงใจเล็ก ๆ สำหรับวัคซีนครบ", "M", rec="S", dur=8,
      eff=[E("health", "up", 2, 1, 8, ["ev.immunization.001"], "ของจูงใจเสริมการนัดที่แน่นอนเพิ่มความครอบคลุม")],
      grp=[G("farmers", "up", 1, "ได้ของชดเชยค่าเดินทาง"), G("urban", "down", 1, "มองว่าเป็นการใช้งบไม่จำเป็น")],
      side=[E("budget", "down", 1, 0, 8, note="ต้องซื้อของและบริหารจัดการ")])]),
 "c": J(3, 4, 3, 1, 2, "บังคับวัคซีนเป็นเงื่อนไขเข้าโรงเรียน", [A("ข้อบังคับวัคซีนก่อนเข้าเรียน", "XS", dur=4, leg=True, risk="medium",
      eff=[E("health", "up", 1, 1, 6, note="ความครอบคลุมในโรงเรียนเพิ่มขึ้น ยังไม่มีหลักฐานในคลัง")],
      grp=[G("youth", "down", 1, "ผู้ปกครองบางส่วนต่อต้าน"), G("farmers", "down", 1, "เด็กห่างไกลเสี่ยงถูกกันออกจากโรงเรียน")],
      side=[E("education", "down", 1, 1, 4, note="เด็กบางส่วนหลุดจากระบบโรงเรียน")])]),
}

# ---- opportunity.fdi.offer ----
P["opportunity.fdi.offer"] = {
 "a": J(4, 5, 3, 2, 3, "ให้สิทธิประโยชน์ภาษีเต็มรูปแบบ", [A("ยกเว้นภาษีและที่ดินราคาพิเศษ", "M", rec="S", dur=8,
      eff=[E("unemployment", "down", 1, 2, 8, note="โรงงานใหม่จ้างงาน")],
      grp=[G("business", "up", 1, "ได้ข้อตกลงเร็ว"), G("youth", "up", 1, "มีงานในโรงงาน"), G("farmers", "down", 1, "ที่ดินถูกเปลี่ยนการใช้")],
      side=[E("budget", "down", 1, 0, 8, note="รัฐเสียรายได้ภาษี สิทธิประโยชน์ไม่ได้ทำให้เศรษฐกิจโตเสมอไป")])]),
 "b": J(4, 3, 3, 3, 2, "รับข้อเสนอพร้อมเงื่อนไขซื้อของและฝึกแรงงานในประเทศ", [A("สิทธิประโยชน์แบบมีเงื่อนไข", "S", dur=8,
      eff=[E("gdpGrowth", "up", 1, 2, 8, ["ev.fdi.002"], "การลงทุนช่วยการเติบโตเมื่อเชื่อมกับทักษะและผู้ผลิตในประเทศ"),
           E("education", "up", 1, 2, 8, note="แรงงานได้ฝึกทักษะ")],
      grp=[G("business", "up", 1, "ผู้ผลิตในประเทศได้ลูกค้า"), G("youth", "up", 1, "ได้ฝึกงาน")],
      side=[E("group:business", "down", 1, 0, 2, note="บริษัทอาจถอนตัวไปลงทุนที่อื่น")])]),
 "c": J(2, 5, 3, 2, 1, "ปฏิเสธและนำงบไปช่วยธุรกิจในประเทศ", [A("สนับสนุนผู้ประกอบการในประเทศ", "S", dur=6,
      eff=[E("group:business", "up", 1, 0, 4, note="ผู้ประกอบการเดิมได้รับการปกป้อง"),
           E("environment", "up", 1, 0, 6, note="ไม่มีโรงงานใหญ่เพิ่ม")],
      grp=[G("business", "up", 1, "ธุรกิจท้องถิ่นได้งบช่วย"), G("youth", "down", 1, "เสียโอกาสงานใหม่")],
      side=[E("foreignRelations", "down", 1, 0, 2, note="นักลงทุนต่างชาติมองว่าเปิดรับน้อย")])]),
}

# ---- politics.cabinet.scandal ----
P["politics.cabinet.scandal"] = {
 "a": J(5, 4, 3, 2, 3, "ตั้งคณะตรวจสอบอิสระและเปิดเผยผล", [A("ตรวจสอบอิสระและเปิดเผยผล", "S", dur=2,
      eff=[E("corruption", "down", 1, 1, 6, note="ความโปร่งใสเพิ่มความเชื่อมั่นระยะยาว"),
           E("pressFreedom", "up", 1, 0, 4, note="ข้อมูลเปิดต่อสาธารณะ")],
      grp=[G("urban", "up", 1, "เห็นความโปร่งใส"), G("business", "up", 1, "ความเชื่อมั่นระยะยาว")],
      side=[E("parliament", "down", 2, 0, 4, ["ev.disclosure.001"], "การเปิดเผยการทุจริตลดเสียงสนับสนุนของผู้เกี่ยวข้อง")])]),
 "b": J(2, 5, 2, 1, 1, "ปรับคณะรัฐมนตรีเงียบ ๆ", [A("ย้ายรัฐมนตรีโดยไม่เปิดเผย", "XS", dur=1,
      eff=[E("stability", "up", 1, 0, 2, note="ลดแรงกดดันได้ชั่วคราว")],
      grp=[G("military", "up", 1, "ไม่มีความวุ่นวาย"), G("urban", "down", 1, "สื่อตั้งคำถามมากขึ้น")],
      side=[E("corruption", "up", 1, 0, 6, note="การทุจริตไม่ถูกแก้"),
            E("pressFreedom", "down", 1, 0, 4, note="ปิดข้อมูลต่อสาธารณะ")])]),
 "c": J(4, 4, 3, 2, 2, "ตรวจสอบสุ่มการจัดซื้อจัดจ้างทุกกระทรวง", [A("สุ่มตรวจสัญญาจัดซื้อจัดจ้าง", "M", rec="S", dur=8,
      eff=[E("corruption", "down", 2, 1, 8, ["ev.audit.001"], "โอกาสถูกตรวจที่สูงขึ้นลดเงินที่รั่วไหล")],
      grp=[G("business", "up", 1, "การแข่งขันประมูลเป็นธรรมขึ้น"), G("urban", "up", 1, "เห็นการปราบทุจริต")],
      side=[E("budget", "down", 1, 0, 8, note="ต้องใช้งบและผู้ตรวจ ข้าราชการรู้สึกถูกจับตา")])]),
}

# ---- society.crime.surge ----
P["society.crime.surge"] = {
 "a": J(5, 4, 3, 2, 3, "เพิ่มตำรวจเฉพาะจุดเสี่ยง", [A("ลาดตระเวนเข้มข้นในจุดเสี่ยง", "M", rec="S", dur=4,
      eff=[E("crime", "down", 2, 0, 4, ["ev.policing.001"], "การรวมกำลังตำรวจในจุดเสี่ยงลดอาชญากรรมได้เล็กน้อยแต่ชัด")],
      grp=[G("urban", "up", 1, "รู้สึกปลอดภัยขึ้น"), G("youth", "down", 1, "ความตึงเครียดกับตำรวจในย่าน")],
      side=[E("budget", "down", 1, 0, 4, note="ค่าล่วงเวลาตำรวจ")])]),
 "b": J(4, 4, 3, 3, 2, "จ้างงานและฝึกอาชีพเยาวชนในย่านเสี่ยง", [A("งานชั่วคราวและฝึกอาชีพเยาวชน", "M", rec="S", dur=8,
      eff=[E("crime", "down", 2, 1, 8, ["ev.policing.002", "ev.employment-crime.001"], "งานสำหรับเยาวชนเสี่ยงลดการถูกจับคดีรุนแรง"),
           E("unemployment", "down", 1, 0, 8, note="เยาวชนมีงานทำ")],
      grp=[G("youth", "up", 2, "ได้งานและทักษะ"), G("urban", "down", 1, "ผลต่อความปลอดภัยเห็นช้า")],
      side=[E("budget", "down", 1, 0, 8, note="ใช้งบต่อเนื่อง")])]),
 "c": J(3, 4, 3, 1, 2, "เพิ่มโทษและตั้งด่านตรวจทั่วเมือง", [A("เพิ่มโทษและด่านตรวจ", "S", dur=4, leg=True, risk="medium",
      eff=[E("crime", "down", 1, 0, 4, note="ภาพความเด็ดขาด ยังไม่มีหลักฐานในคลัง")],
      grp=[G("youth", "down", 2, "ถูกตรวจค้นบ่อย"), G("military", "up", 1, "เห็นด้วยกับความเด็ดขาด")],
      side=[E("pressFreedom", "down", 1, 0, 4, note="กระทบเสรีภาพของประชาชน"),
            E("stability", "down", 1, 1, 3, note="ความไม่พอใจของเยาวชน")])]),
}

# ---- society.strike.general ----
P["society.strike.general"] = {
 "a": J(5, 4, 3, 3, 3, "เจรจาสามฝ่ายและขึ้นค่าจ้างขั้นต่ำเป็นขั้น", [A("เจรจาสามฝ่ายและปรับค่าจ้างขั้นต่ำ", "S", dur=4, leg=True,
      eff=[E("inequality", "down", 1, 1, 6, note="รายได้แรงงานดีขึ้น"),
           E("stability", "up", 1, 0, 2, note="การนัดหยุดงานยุติ")],
      grp=[G("urban", "up", 2, "แรงงานได้ค่าจ้างเพิ่ม"), G("business", "down", 1, "ธุรกิจรายเล็กต้นทุนสูงขึ้น")],
      side=[E("inflation", "up", 1, 1, 4, note="ราคาสินค้าอาจขยับ"),
            E("unemployment", "up", 1, 1, 4, ["ev.minimum-wage.001"], "หลักฐานชี้ว่าจำนวนงานแทบไม่เปลี่ยน จึงเป็นผลระดับเล็ก")])]),
 "b": J(3, 4, 3, 2, 2, "สร้างงานสาธารณะและฝึกอาชีพ", [A("งานสาธารณะและฝึกทักษะ", "L", rec="M", dur=8,
      eff=[E("inequality", "down", 2, 1, 8, ["ev.public-works.001"], "งานสาธารณะเพิ่มรายได้ครัวเรือนยากจน"),
           E("unemployment", "down", 1, 4, 8, ["ev.youth-jobs.001"], "ผลการฝึกอาชีพเห็นหลังสองถึงสามปี")],
      grp=[G("urban", "up", 1, "ผู้ว่างงานได้งาน"), G("youth", "up", 1, "ได้ฝึกทักษะ"), G("business", "down", 1, "ภาษีสูงขึ้นในอนาคต")],
      side=[E("debt", "up", 1, 0, 8, note="ใช้งบมาก")])]),
 "c": J(3, 3, 3, 1, 2, "ประกาศบริการจำเป็นและสั่งให้กลับเข้าทำงาน", [A("คำสั่งกลับเข้าทำงานในบริการจำเป็น", "XS", dur=1, leg=True, risk="medium",
      eff=[E("gdpGrowth", "up", 1, 0, 1, note="ท่าเรือและขนส่งกลับมาเดิน")],
      grp=[G("urban", "down", 2, "แรงงานโกรธ"), G("business", "up", 1, "กิจการกลับมาเดิน"), G("military", "up", 1, "ความสงบเรียบร้อย")],
      side=[E("stability", "down", 1, 1, 3, note="เสี่ยงการชุมนุมใหญ่"),
            E("pressFreedom", "down", 1, 0, 3, note="จำกัดสิทธิการรวมตัว")])]),
}

out = defaultdict(list)
for card, choices in P.items():
    for cid, j in choices.items():
        out[card].append({"cardId": card, "choiceId": cid, "judgment": j, "runs": 1, "model": MODEL,
                          "promptVersion": PROMPT, "createdAt": CREATED})
os.makedirs("data/prejudged", exist_ok=True)
for card, items in out.items():
    with open(f"data/prejudged/{card}.json", "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
print(sum(len(v) for v in out.values()), "choices pre-judged in", len(out), "files")
