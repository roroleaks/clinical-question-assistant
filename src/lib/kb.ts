export type SpecialtyKey = "infertility" | "gynecology" | "obstetrics";

export interface SpecialtyKB {
  label: string;
  conditions: string[];
  interventions: string[];
  outcomesRanked: string[];
  terminology: string[];
}

export const KB: Record<SpecialtyKey, SpecialtyKB> = {
  infertility: {
    label: "Infertility / Reproductive Medicine",
    conditions: [
      "PCOS", "endometriosis", "recurrent implantation failure", "male factor infertility",
      "azoospermia", "thin endometrium", "hydrosalpinx", "uterine septum",
      "unexplained infertility", "diminished ovarian reserve", "adenomyosis", "fibroids"
    ],
    interventions: [
      "letrozole", "clomiphene citrate", "aspirin", "low molecular weight heparin",
      "IVF", "ICSI", "IUI", "laparoscopic surgery", "hysteroscopic surgery",
      "progesterone", "metformin", "G-CSF", "prednisolone", "PGT-A", "embryo glue",
      "coenzyme Q10", "myo-inositol", "vitamin D", "melatonin", "omega-3",
      "vitamin E", "selenium", "acupuncture"
    ],
    outcomesRanked: [
      "cumulative live birth rate", "live birth rate", "ongoing pregnancy rate",
      "clinical pregnancy rate", "implantation rate", "miscarriage rate", "OHSS incidence"
    ],
    terminology: ["IVF", "ICSI", "ART", "OHSS", "RIF", "LBR", "CPR"]
  },
  gynecology: {
    label: "Gynecology",
    conditions: [
      "fibroids", "endometriosis", "adenomyosis", "heavy menstrual bleeding",
      "endometrial hyperplasia", "ovarian cysts", "pelvic organ prolapse",
      "chronic pelvic pain", "PCOS", "dyspareunia", "dysmenorrhea"
    ],
    interventions: [
      "myomectomy", "hysterectomy", "uterine artery embolization", "laparoscopy",
      "hysteroscopy", "levonorgestrel IUS", "tranexamic acid", "GnRH agonist",
      "GnRH antagonist", "endometrial ablation"
    ],
    outcomesRanked: [
      "patient-reported symptom relief", "quality of life scores", "hemoglobin change",
      "reoperation rate", "major complications", "patient satisfaction"
    ],
    terminology: ["HMB", "UAE", "LNG-IUS"]
  },
  obstetrics: {
    label: "Obstetrics",
    conditions: [
      "preterm birth risk", "short cervix", "preeclampsia", "gestational diabetes",
      "placenta accreta spectrum", "placenta previa", "fetal growth restriction",
      "PPROM", "recurrent miscarriage", "twin pregnancy", "breech presentation"
    ],
    interventions: [
      "cervical cerclage", "vaginal progesterone", "low-dose aspirin", "cervical pessary",
      "antenatal corticosteroids", "magnesium sulfate", "insulin", "metformin",
      "external cephalic version"
    ],
    outcomesRanked: [
      "perinatal mortality", "neonatal morbidity composite", "gestational age at delivery",
      "preterm birth < 37 weeks", "birthweight", "maternal morbidity", "NICU admission"
    ],
    terminology: ["PTB", "FGR", "PPROM", "GDM", "PAS"]
  }
};

export const SYNONYMS: Record<string, string> = {
  "coenzyme q10": "coenzyme Q10",
  "coq10": "coenzyme Q10",
  "ubiquinol": "coenzyme Q10",
  "ubidecarenone": "coenzyme Q10",
  "clomid": "clomiphene citrate",
  "serophene": "clomiphene citrate",
  "myoinositol": "myo-inositol",
  "inositol": "myo-inositol",
  "lmwh": "low molecular weight heparin",
  "clexane": "low molecular weight heparin",
  "enoxaparin": "low molecular weight heparin",
  "vitd": "vitamin D",
  "endometriosis excision": "endometriosis surgery",
  "laparoscopic excision": "endometriosis surgery"
};

export const QUESTION_TYPES = [
  { type: "Therapy / Prevention", framework: "PICO" },
  { type: "Diagnosis", framework: "Diagnostic accuracy (PIRD)" },
  { type: "Prognosis", framework: "PECO prognostic" },
  { type: "Etiology / Risk factors", framework: "PECO" },
  { type: "Screening", framework: "Population-Test-Comparator-Outcome" },
  { type: "Harm", framework: "PECO harm" }
];

export interface Analysis {
  specialty: SpecialtyKey | null;
  specialtyLabel: string;
  condition: string;
  intervention: string;
  comparator: string;
  questionType: string;
  framework: string;
  missing: string[];
  interpretation: string;
  source: "ai" | "rules";
}

export interface Clarification {
  done: boolean;
  field: string | null;
  questionText: string;
  options: string[];
  allowFreeText: boolean;
  source: "ai" | "rules";
}

export interface Formulation {
  framework: string;
  elements: { label: string; value: string }[];
  finalQuestion: string;
  scores: { name: string; value: number }[];
  advisories: string[];
  searchTerms: { population: string; intervention: string; outcome: string };
  source: "ai" | "rules";
}
