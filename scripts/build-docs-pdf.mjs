import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'

// ── Document order (logical reading order) ──────────────────────────────────
const DOCS = [
  { file: 'docs/system-documentation.md',             title: 'System Documentation' },
  { file: 'docs/user-manual.md',                      title: 'User Manual' },
  { file: 'docs/api-reference.md',                    title: 'API Reference' },
  { file: 'docs/schema.md',                           title: 'Database Schema' },
  { file: 'docs/glossary.md',                         title: 'Glossary' },
  { file: 'docs/facility-onboarding.md',              title: 'Facility Onboarding' },
  { file: 'docs/integration-activation-manual.md',    title: 'Integration & Activation Manual' },
  { file: 'docs/file-manifest-and-hie-activation.md', title: 'File Manifest & HIE Activation' },
  { file: 'docs/moh-tagging-architecture.md',         title: 'MOH Tagging Architecture' },
  { file: 'docs/dha-compliance-assessment.md',        title: 'DHA Compliance Assessment' },
  { file: 'docs/self-attestation.md',                 title: 'Developer Self-Attestation' },
]

const TODAY = new Date().toISOString().slice(0, 10)
const VERSION = 'v5.16'
const OUTPUT_DIR = 'docs/pdf'
const COMBINED_MD = 'docs/combined-for-pdf.md'
const OUTPUT_PDF = `${OUTPUT_DIR}/AegisCare-HMS-${VERSION}-Full-Documentation.pdf`

// ── Ensure output dir exists ─────────────────────────────────────────────────
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })

// ── Build TOC ────────────────────────────────────────────────────────────────
function buildToc() {
  let toc = `# Table of Contents\n\n`
  DOCS.forEach((doc, i) => {
    toc += `${i + 1}. **${doc.title}**\n`
  })
  return toc
}

// ── Cover Page ───────────────────────────────────────────────────────────────
const cover = `---
pdf_options:
  format: A4
  margin:
    top: 25mm
    right: 20mm
    bottom: 25mm
    left: 20mm
  printBackground: true
  displayHeaderFooter: true
  headerTemplate: >-
    <div style="font-size:8px;width:100%;text-align:right;
    padding-right:20mm;color:#64748b;font-family:Segoe UI,Arial,sans-serif;">
      AegisCare HMS ${VERSION} — Confidential
    </div>
  footerTemplate: >-
    <div style="font-size:8px;width:100%;text-align:center;
    color:#64748b;font-family:Segoe UI,Arial,sans-serif;">
      Page <span class="pageNumber"></span> of <span class="totalPages"></span>
    </div>
stylesheet: docs/pdf-style.css
---

<div style="text-align:center;padding-top:100px;page-break-after:always;">

# AegisCare HMS

## Complete Documentation Package

### ${VERSION}

---

**AegisCare / LabTrack**

Prepared by: Francis Muhoro

Date: ${TODAY}

Repository: fmurage6331-dev/confit-core

Primary URL: https://aegiscare-orcin.vercel.app

---

*This document is confidential and intended for authorized personnel only.*

*Total documents: ${DOCS.length}*

</div>

---

<div style="page-break-after:always;">

${buildToc()}

</div>

---

`

// ── Combine all docs ──────────────────────────────────────────────────────────
let combined = cover

DOCS.forEach((doc, i) => {
  if (!existsSync(doc.file)) {
    console.warn(`⚠️  Skipping missing file: ${doc.file}`)
    return
  }

  const content = readFileSync(doc.file, 'utf8')
    // Remove existing front matter if any
    .replace(/^---[\s\S]*?---\n/, '')
    .trim()

  combined += `\n\n<div style="page-break-before:always;">\n\n`
  combined += `<!-- DOCUMENT ${i + 1}: ${doc.title} -->\n\n`
  combined += content
  combined += `\n\n</div>\n\n`
  combined += `---\n\n`

  console.log(`✅ Added: ${doc.title}`)
})

// ── Write combined markdown ───────────────────────────────────────────────────
writeFileSync(COMBINED_MD, combined, 'utf8')
console.log(`\n📄 Combined markdown written to: ${COMBINED_MD}`)

// ── Convert to PDF ────────────────────────────────────────────────────────────
console.log(`\n🔄 Converting to PDF... (this may take 30–60 seconds)`)
try {
  execSync(`npx md-to-pdf ${COMBINED_MD}`, { stdio: 'inherit' })

  // md-to-pdf outputs to same dir as input with .pdf extension
  const generatedPdf = COMBINED_MD.replace('.md', '.pdf')
  if (existsSync(generatedPdf)) {
    // Move to final location
    const { renameSync } = await import('fs')
    writeFileSync(OUTPUT_PDF,
      readFileSync(generatedPdf))
    // Remove temp files
    import('fs').then(fs => {
      try { fs.unlinkSync(generatedPdf) } catch {}
      try { fs.unlinkSync(COMBINED_MD) } catch {}
    })
    console.log(`\n✅ PDF created: ${OUTPUT_PDF}`)
  }
} catch (err) {
  console.error('❌ PDF conversion failed:', err.message)
  process.exit(1)
}