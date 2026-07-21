-- Migration: Create MOH 705 Disease Mapping Table and Initial Seed Data
-- Location: supabase/migrations/20260721000000_create_moh_705_disease_mappings.sql

CREATE TABLE IF NOT EXISTS public.moh_705_disease_mappings (
    row_number INT PRIMARY KEY,
    disease_name TEXT NOT NULL,
    icd11_chapter_block TEXT,
    keyword_pattern TEXT,
    requires_lab_confirmation BOOLEAN DEFAULT FALSE,
    requires_deceased_status BOOLEAN DEFAULT FALSE
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.moh_705_disease_mappings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read the mapping data
CREATE POLICY "Allow public read access to MOH 705 disease mappings" 
ON public.moh_705_disease_mappings 
FOR SELECT 
USING (true);

-- Insert/Upsert the 69 Form Rows
INSERT INTO public.moh_705_disease_mappings (row_number, disease_name, icd11_chapter_block, keyword_pattern, requires_lab_confirmation, requires_deceased_status) VALUES
(1, 'Diarrhoea, no dehydration', NULL, '%diarrh%', FALSE, FALSE),
(2, 'Diarrhoea, some dehydration', NULL, '%diarrh%some%dehydrat%', FALSE, FALSE),
(3, 'Diarrhoea, severe dehydration', NULL, '%diarrh%severe%dehydrat%', FALSE, FALSE),
(4, 'Cholera', '1A00', '%cholera%', FALSE, FALSE),
(5, 'Dysentery', '1A03', '%dysentery%', FALSE, FALSE),
(6, 'Gastroenteritis', '1A0', '%gastroenteritis%', FALSE, FALSE),
(7, 'Pneumonia', 'CA40', '%pneumonia%', FALSE, FALSE),
(8, 'Severe pneumonia', NULL, '%severe%pneumonia%', FALSE, FALSE),
(9, 'Upper Respiratory Tract Infections', 'CA00', '%upper respiratory%', FALSE, FALSE),
(10, 'Lower Respiratory Tract Infections', 'CA20', '%lower respiratory%', FALSE, FALSE),
(11, 'Asthma', 'CA23', '%asthma%', FALSE, FALSE),
(12, 'Presumed Tuberculosis', '1B10', '%tuberculosis%', FALSE, FALSE),
(13, 'Suspected Malaria', '1F40', '%malaria%', FALSE, FALSE),
(14, 'Tested Malaria', '1F40', '%malaria%', TRUE, FALSE),
(15, 'Confirmed Malaria', '1F40', '%malaria%', TRUE, FALSE),
(16, 'Ear infection', 'AA00', '%otitis%', FALSE, FALSE),
(17, 'Malnutrition', '5B50', '%malnutrition%', FALSE, FALSE),
(18, 'Anaemia', '3A00', '%anaemia%', FALSE, FALSE),
(19, 'Meningococcal Meningitis', '1D01', '%meningococcal%', FALSE, FALSE),
(20, 'Other Meningitis', '1D00', '%meningitis%', FALSE, FALSE),
(21, 'Neonatal Sepsis', 'KA60', '%neonatal sepsis%', FALSE, FALSE),
(22, 'Neonatal Tetanus', '1C10', '%neonatal tetanus%', FALSE, FALSE),
(23, 'Poliomyelitis (AFP)', '1C80', '%poliomyelitis%', FALSE, FALSE),
(24, 'Chicken Pox', '1E91', '%chicken%pox%', FALSE, FALSE),
(25, 'Measles', '1B80', '%measles%', FALSE, FALSE),
(26, 'Hepatitis', '1E50', '%hepatitis%', FALSE, FALSE),
(27, 'Amoebiasis', '1A06', '%amoebiasis%', FALSE, FALSE),
(28, 'Mumps', '1D80', '%mumps%', FALSE, FALSE),
(29, 'Typhoid fever', '1A07', '%typhoid%', FALSE, FALSE),
(30, 'Bilharzia / Schistosomiasis', '1B70', '%schistosomiasis%', FALSE, FALSE),
(31, 'Intestinal worms', '1F60', '%helminth%', FALSE, FALSE),
(32, 'Eye infections', '9A00', '%conjunctivitis%', FALSE, FALSE),
(33, 'Tonsillitis', 'CA03', '%tonsillitis%', FALSE, FALSE),
(34, 'Urinary Tract Infections', 'GC00', '%urinary tract%', FALSE, FALSE),
(35, 'Mental Disorders', '06', '%mental%', FALSE, FALSE),
(36, 'Dental Disorders', 'DA00', '%dental%', FALSE, FALSE),
(37, 'Jiggers infestation', '1G00', '%tungiasis%', FALSE, FALSE),
(38, 'Diseases of the skin', '14', '%skin%', FALSE, FALSE),
(39, 'Down''s syndrome', 'LD20', '%down%syndrome%', FALSE, FALSE),
(40, 'Poisoning', 'NE60', '%poisoning%', FALSE, FALSE),
(41, 'Road Traffic Injuries', 'PA00', '%road traffic%', FALSE, FALSE),
(42, 'Deaths due to RTIs', 'PA00', '%road traffic%', FALSE, TRUE),
(43, 'Violence related injuries', 'PE00', '%violence%', FALSE, FALSE),
(44, 'Other injuries', 'PA', '%injury%', FALSE, FALSE),
(45, 'Sexual Violence', 'PE01', '%sexual violence%', FALSE, FALSE),
(46, 'Burns', 'ND00', '%burn%', FALSE, FALSE),
(47, 'Snake Bites', 'NE80', '%snake bite%', FALSE, FALSE),
(48, 'Dog Bites', 'NE81', '%dog bite%', FALSE, FALSE),
(49, 'Other Bites', 'NE82', '%bite%', FALSE, FALSE),
(50, 'Diabetes', '5A10', '%diabetes%', FALSE, FALSE),
(51, 'Epilepsy', '8A60', '%epilepsy%', FALSE, FALSE),
(52, 'Other Convulsive Disorders', '8A61', '%convulsi%', FALSE, FALSE),
(53, 'Rheumatic Fever', '1C40', '%rheumatic fever%', FALSE, FALSE),
(54, 'Brucellosis', '1B90', '%brucellosis%', FALSE, FALSE),
(55, 'Rickets', '5B56', '%rickets%', FALSE, FALSE),
(56, 'Cerebral Palsy', '8D20', '%cerebral palsy%', FALSE, FALSE),
(57, 'Autism', '6A02', '%autis%', FALSE, FALSE),
(58, 'Trypanosomiasis', '1F41', '%trypanosomiasis%', FALSE, FALSE),
(59, 'Yellow Fever', '1D40', '%yellow fever%', FALSE, FALSE),
(60, 'Viral Haemorrhagic Fever', '1D41', '%haemorrhagic fever%', FALSE, FALSE),
(61, 'Rift Valley Fever', '1D42', '%rift valley%', FALSE, FALSE),
(62, 'Chikungunya', '1D43', '%chikungunya%', FALSE, FALSE),
(63, 'Dengue fever', '1D44', '%dengue%', FALSE, FALSE),
(64, 'Leishmaniasis (Visceral)', '1F42', '%leishmaniasis%', FALSE, FALSE),
(65, 'Cutaneous leishmaniasis', '1F43', '%cutaneous leishmaniasis%', FALSE, FALSE),
(66, 'Suspected anthrax', '1B91', '%anthrax%', FALSE, FALSE),
(67, 'Suspected Diphtheria / Tetanus', '1A30', '%diphtheria%', FALSE, FALSE),
(68, 'Trachoma (Active)', '1B00', '%trachoma%', FALSE, FALSE),
(69, 'All Other Diseases', 'ALL_OTHER', '%other%', FALSE, FALSE)
ON CONFLICT (row_number) DO UPDATE SET 
    disease_name = EXCLUDED.disease_name,
    icd11_chapter_block = EXCLUDED.icd11_chapter_block,
    keyword_pattern = EXCLUDED.keyword_pattern,
    requires_lab_confirmation = EXCLUDED.requires_lab_confirmation,
    requires_deceased_status = EXCLUDED.requires_deceased_status;
