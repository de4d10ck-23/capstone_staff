/**
 * Official 70 Barangays of the City of Maasin, Southern Leyte
 * PSGC Locality Code: 086407000
 */
export const MAASIN_BARANGAYS = [
  "Abgao",
  "Asuncion",
  "Bactul I",
  "Bactul II",
  "Badiang",
  "Bagtican",
  "Basak",
  "Bato I",
  "Bato II",
  "Batuan",
  "Baugo",
  "Bilibol",
  "Bogo",
  "Cabadiangan",
  "Cabulihan",
  "Cagnituan",
  "Cambooc",
  "Cansirong",
  "Canturing",
  "Canyuom",
  "Combado",
  "Dongon",
  "Gawisan",
  "Guadalupe",
  "Hanginan",
  "Hantag",
  "Hinapu Daku",
  "Hinapu Gamay",
  "Ibarra",
  "Isagani",
  "Laboon",
  "Lanao",
  "Lib-og",
  "Libhu",
  "Libertad",
  "Lonoy",
  "Lunas",
  "Mahayahay",
  "Malapoc Norte",
  "Malapoc Sur",
  "Mambajao",
  "Manhilo",
  "Mantahan",
  "Maria Clara",
  "Matin-ao",
  "Nasaug",
  "Nati",
  "Nonok Norte",
  "Nonok Sur",
  "Panan-awan",
  "Pansaan",
  "Pasay",
  "Pinaskuhan",
  "Rizal",
  "San Agustin",
  "San Isidro",
  "San Jose",
  "San Rafael",
  "Santa Cruz",
  "Santa Rosa",
  "Santo Niño",
  "Santo Rosario",
  "Sisi",
  "Tagnipa",
  "Tam-is",
  "Tawid",
  "Tigbawan",
  "Tomoy-tomoy",
  "Tunga-tunga",
  "Zaragosa"
];

export const MAASIN_BARANGAY_POPULATION = {
  "Abgao": 2510,
  "Acasia": 343,
  "Asuncion": 5063,
  "Bactul I": 552,
  "Bactul II": 581,
  "Badiang": 1264,
  "Bagtican": 675,
  "Basak": 780,
  "Bato I": 708,
  "Bato II": 515,
  "Batuan": 1098,
  "Baugo": 559,
  "Bilibol": 1095,
  "Bogo": 808,
  "Cabadiangan": 440,
  "Cabulihan": 1258,
  "Cagnituan": 356,
  "Cambooc": 767,
  "Cansirong": 963,
  "Canturing": 1138,
  "Canyuom": 639,
  "Combado": 5854,
  "Dongon": 1472,
  "Gawisan": 522,
  "Guadalupe": 1702,
  "Hanginan": 800,
  "Hantag": 788,
  "Hinapu Daku": 942,
  "Hinapu Gamay": 871,
  "Ibarra": 4346,
  "Isagani": 1289,
  "Laboon": 1604,
  "Lanao": 547,
  "Lib-og": 1580,
  "Libhu": 1785,
  "Libertad": 432,
  "Lonoy": 764,
  "Lunas": 1702,
  "Mahayahay": 1223,
  "Malapoc Norte": 927,
  "Malapoc Sur": 451,
  "Mambajao": 1948,
  "Manhilo": 1661,
  "Mantahan": 4106,
  "Maria Clara": 2406,
  "Matin-ao": 644,
  "Nasaug": 728,
  "Nati": 335,
  "Nonok Norte": 515,
  "Nonok Sur": 678,
  "Panan-awan": 1304,
  "Pansaan": 542,
  "Pasay": 1014,
  "Pinaskuhan": 552,
  "Pinascohan": 552,
  "Rizal": 2061,
  "San Agustin": 465,
  "San Isidro": 568,
  "San Jose": 1102,
  "San Rafael": 1862,
  "Santa Cruz": 871,
  "Santa Rosa": 228,
  "Santo Niño": 723,
  "Santo Rosario": 1016,
  "Sisi": 1189,
  "Soro-soro": 1189,
  "Tagnipa": 3266,
  "Tam-is": 1491,
  "Tawid": 932,
  "Tigbawan": 1082,
  "Tomoy-tomoy": 491,
  "Tunga-tunga": 1953,
  "Zaragosa": 350
};

export const MAX_BARANGAY_POPULATION = 5854;

export const getBarangayPopulation = (barangayName) => {
  if (!barangayName) return 1000;
  const clean = String(barangayName).trim().toLowerCase();
  for (const [name, pop] of Object.entries(MAASIN_BARANGAY_POPULATION)) {
    if (name.toLowerCase() === clean) return pop;
  }
  const stripped = clean
    .replace(/\(.*?\)/g, "")
    .replace(/\b(barangay|brgy\.?|bgy\.?|poblacion|pob\.?)\b/g, "")
    .replace(/ 1/g, " i")
    .replace(/ 2/g, " ii")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9\- ]/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  for (const [name, pop] of Object.entries(MAASIN_BARANGAY_POPULATION)) {
    const nClean = name.toLowerCase().replace(/ñ/g, "n");
    if (nClean === stripped || nClean.includes(stripped) || stripped.includes(nClean)) {
      return pop;
    }
  }
  return 1000;
};

export default MAASIN_BARANGAYS;

