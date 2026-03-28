import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const bowlingShoes = [
  // RG Racer FL WHITE (sizes 230-295)
  { sku: '300649', name: 'RG Racer FL WHITE (230)' },
  { sku: '300650', name: 'RG Racer FL WHITE (235)' },
  { sku: '300651', name: 'RG Racer FL WHITE (240)' },
  { sku: '300652', name: 'RG Racer FL WHITE (245)' },
  { sku: '300653', name: 'RG Racer FL WHITE (250)' },
  { sku: '300654', name: 'RG Racer FL WHITE (255)' },
  { sku: '300655', name: 'RG Racer FL WHITE (260)' },
  { sku: '300656', name: 'RG Racer FL WHITE (265)' },
  { sku: '300657', name: 'RG Racer FL WHITE (270)' },
  { sku: '300658', name: 'RG Racer FL WHITE (275)' },
  { sku: '300659', name: 'RG Racer FL WHITE (280)' },
  { sku: '300660', name: 'RG Racer FL WHITE (285)' },
  { sku: '300661', name: 'RG Racer FL WHITE (290)' },
  { sku: '300662', name: 'RG Racer FL WHITE (295)' },
  // RG Racer FL BLACK (sizes 230-295)
  { sku: '300663', name: 'RG Racer FL BLACK (230)' },
  { sku: '300664', name: 'RG Racer FL BLACK (235)' },
  { sku: '300665', name: 'RG Racer FL BLACK (240)' },
  { sku: '300666', name: 'RG Racer FL BLACK (245)' },
  { sku: '300667', name: 'RG Racer FL BLACK (250)' },
  { sku: '300668', name: 'RG Racer FL BLACK (255)' },
  { sku: '300669', name: 'RG Racer FL BLACK (260)' },
  { sku: '300670', name: 'RG Racer FL BLACK (265)' },
  { sku: '300671', name: 'RG Racer FL BLACK (270)' },
  { sku: '300672', name: 'RG Racer FL BLACK (275)' },
  { sku: '300673', name: 'RG Racer FL BLACK (280)' },
  { sku: '300674', name: 'RG Racer FL BLACK (285)' },
  { sku: '300675', name: 'RG Racer FL BLACK (290)' },
  { sku: '300676', name: 'RG Racer FL BLACK (295)' },
  // RG RACER FL WHITE - WIDE (sizes 250-295)
  { sku: '300928', name: 'RG RACER FL WHITE - WIDE (250)' },
  { sku: '300929', name: 'RG RACER FL WHITE - WIDE (255)' },
  { sku: '300930', name: 'RG RACER FL WHITE - WIDE (260)' },
  { sku: '300931', name: 'RG RACER FL WHITE - WIDE (265)' },
  { sku: '300932', name: 'RG RACER FL WHITE - WIDE (270)' },
  { sku: '300933', name: 'RG RACER FL WHITE - WIDE (275)' },
  { sku: '300934', name: 'RG RACER FL WHITE - WIDE (280)' },
  { sku: '300935', name: 'RG RACER FL WHITE - WIDE (285)' },
  { sku: '300936', name: 'RG RACER FL WHITE - WIDE (290)' },
  { sku: '300937', name: 'RG RACER FL WHITE - WIDE (295)' },
  // RG RACER ROO WHITE (sizes 230-295)
  { sku: '300844', name: 'RG RACER ROO WHITE (230)' },
  { sku: '300845', name: 'RG RACER ROO WHITE (235)' },
  { sku: '300846', name: 'RG RACER ROO WHITE (240)' },
  { sku: '300847', name: 'RG RACER ROO WHITE (245)' },
  { sku: '300848', name: 'RG RACER ROO WHITE (250)' },
  { sku: '300849', name: 'RG RACER ROO WHITE (255)' },
  { sku: '300850', name: 'RG RACER ROO WHITE (260)' },
  { sku: '300851', name: 'RG RACER ROO WHITE (265)' },
  { sku: '300852', name: 'RG RACER ROO WHITE (270)' },
  { sku: '300853', name: 'RG RACER ROO WHITE (275)' },
  { sku: '300854', name: 'RG RACER ROO WHITE (280)' },
  { sku: '300855', name: 'RG RACER ROO WHITE (285)' },
  { sku: '300856', name: 'RG RACER ROO WHITE (290)' },
  { sku: '300857', name: 'RG RACER ROO WHITE (295)' },
  // RG RACER ROO BLACK (sizes 230-295)
  { sku: '300858', name: 'RG RACER ROO BLACK (230)' },
  { sku: '300859', name: 'RG RACER ROO BLACK (235)' },
  { sku: '300860', name: 'RG RACER ROO BLACK (240)' },
  { sku: '300861', name: 'RG RACER ROO BLACK (245)' },
  { sku: '300862', name: 'RG RACER ROO BLACK (250)' },
  { sku: '300863', name: 'RG RACER ROO BLACK (255)' },
  { sku: '300864', name: 'RG RACER ROO BLACK (260)' },
  { sku: '300865', name: 'RG RACER ROO BLACK (265)' },
  { sku: '300866', name: 'RG RACER ROO BLACK (270)' },
  { sku: '300867', name: 'RG RACER ROO BLACK (275)' },
  { sku: '300868', name: 'RG RACER ROO BLACK (280)' },
  { sku: '300869', name: 'RG RACER ROO BLACK (285)' },
  { sku: '300870', name: 'RG RACER ROO BLACK (290)' },
  { sku: '300871', name: 'RG RACER ROO BLACK (295)' },
  // RG RACER ROO WHITE - WIDE (sizes 250-295)
  { sku: '300938', name: 'RG RACER ROO WHITE - WIDE (250)' },
  { sku: '300939', name: 'RG RACER ROO WHITE - WIDE (255)' },
  { sku: '300940', name: 'RG RACER ROO WHITE - WIDE (260)' },
  { sku: '300941', name: 'RG RACER ROO WHITE - WIDE (265)' },
  { sku: '300942', name: 'RG RACER ROO WHITE - WIDE (270)' },
  { sku: '300943', name: 'RG RACER ROO WHITE - WIDE (275)' },
  { sku: '300944', name: 'RG RACER ROO WHITE - WIDE (280)' },
  { sku: '300945', name: 'RG RACER ROO WHITE - WIDE (285)' },
  { sku: '300946', name: 'RG RACER ROO WHITE - WIDE (290)' },
  { sku: '300947', name: 'RG RACER ROO WHITE - WIDE (295)' },
  // Toe Cap
  { sku: '300740', name: 'TOE CAP(RG RACER FL) BLUE (Small(~255))' },
  { sku: '300741', name: 'TOE CAP(RG RACER FL) BLUE (Large(~295))' },
  { sku: '300742', name: 'TOE CAP(RG RACER FL) BLACK (Small(~255))' },
  { sku: '300743', name: 'TOE CAP(RG RACER FL) BLACK (Large(~295))' },
  // Storm Shoe Slider (no size)
  { sku: '300677', name: 'STORM SHOE SLIDER' },
  // RG Racer Accessory Package
  { sku: '300744', name: 'RG RACER ACCESSORY PACKAGE (230/235)' },
  { sku: '300745', name: 'RG RACER ACCESSORY PACKAGE (240/245)' },
  { sku: '300746', name: 'RG RACER ACCESSORY PACKAGE (250/255)' },
  { sku: '300747', name: 'RG RACER ACCESSORY PACKAGE (260/265)' },
  { sku: '300748', name: 'RG RACER ACCESSORY PACKAGE (270/275)' },
  { sku: '300749', name: 'RG RACER ACCESSORY PACKAGE (280/285)' },
  { sku: '300750', name: 'RG RACER ACCESSORY PACKAGE (290/295)' },
  // RG SOLE S4
  { sku: '300872', name: 'RG SOLE S4 (230/235)' },
  { sku: '300873', name: 'RG SOLE S4 (240/245)' },
  { sku: '300874', name: 'RG SOLE S4 (250/255)' },
  { sku: '300875', name: 'RG SOLE S4 (260/265)' },
  { sku: '300876', name: 'RG SOLE S4 (270/275)' },
  { sku: '300877', name: 'RG SOLE S4 (280/285)' },
  { sku: '300878', name: 'RG SOLE S4 (290/295)' },
  // RG SOLE S10
  { sku: '300879', name: 'RG SOLE S10 (230/235)' },
  { sku: '300880', name: 'RG SOLE S10 (240/245)' },
  { sku: '300881', name: 'RG SOLE S10 (250/255)' },
  { sku: '300882', name: 'RG SOLE S10 (260/265)' },
  { sku: '300883', name: 'RG SOLE S10 (270/275)' },
  { sku: '300884', name: 'RG SOLE S10 (280/285)' },
  { sku: '300885', name: 'RG SOLE S10 (290/295)' },
  // RG SOLE S18
  { sku: '300886', name: 'RG SOLE S18 (230/235)' },
  { sku: '300887', name: 'RG SOLE S18 (240/245)' },
  { sku: '300888', name: 'RG SOLE S18 (250/255)' },
  { sku: '300889', name: 'RG SOLE S18 (260/265)' },
  { sku: '300890', name: 'RG SOLE S18 (270/275)' },
  { sku: '300891', name: 'RG SOLE S18 (280/285)' },
  { sku: '300892', name: 'RG SOLE S18 (290/295)' },
  // RG HEEL H3
  { sku: '300893', name: 'RG HEEL H3 (230/235)' },
  { sku: '300894', name: 'RG HEEL H3 (240/245)' },
  { sku: '300895', name: 'RG HEEL H3 (250/255)' },
  { sku: '300896', name: 'RG HEEL H3 (260/265)' },
  { sku: '300897', name: 'RG HEEL H3 (270/275)' },
  { sku: '300898', name: 'RG HEEL H3 (280/285)' },
  { sku: '300899', name: 'RG HEEL H3 (290/295)' },
  // RG HEEL H4
  { sku: '300900', name: 'RG HEEL H4 (230/235)' },
  { sku: '300901', name: 'RG HEEL H4 (240/245)' },
  { sku: '300902', name: 'RG HEEL H4 (250/255)' },
  { sku: '300903', name: 'RG HEEL H4 (260/265)' },
  { sku: '300904', name: 'RG HEEL H4 (270/275)' },
  { sku: '300905', name: 'RG HEEL H4 (280/285)' },
  { sku: '300906', name: 'RG HEEL H4 (290/295)' },
  // RG HEEL H7
  { sku: '300907', name: 'RG HEEL H7 (230/235)' },
  { sku: '300908', name: 'RG HEEL H7 (240/245)' },
  { sku: '300909', name: 'RG HEEL H7 (250/255)' },
  { sku: '300910', name: 'RG HEEL H7 (260/265)' },
  { sku: '300911', name: 'RG HEEL H7 (270/275)' },
  { sku: '300912', name: 'RG HEEL H7 (280/285)' },
  { sku: '300913', name: 'RG HEEL H7 (290/295)' },
  // RG HEEL H11
  { sku: '300914', name: 'RG HEEL H11 (230/235)' },
  { sku: '300915', name: 'RG HEEL H11 (240/245)' },
  { sku: '300916', name: 'RG HEEL H11 (250/255)' },
  { sku: '300917', name: 'RG HEEL H11 (260/265)' },
  { sku: '300918', name: 'RG HEEL H11 (270/275)' },
  { sku: '300919', name: 'RG HEEL H11 (280/285)' },
  { sku: '300920', name: 'RG HEEL H11 (290/295)' },
  // RG HEEL H15
  { sku: '300921', name: 'RG HEEL H15 (230/235)' },
  { sku: '300922', name: 'RG HEEL H15 (240/245)' },
  { sku: '300923', name: 'RG HEEL H15 (250/255)' },
  { sku: '300924', name: 'RG HEEL H15 (260/265)' },
  { sku: '300925', name: 'RG HEEL H15 (270/275)' },
  { sku: '300926', name: 'RG HEEL H15 (280/285)' },
  { sku: '300927', name: 'RG HEEL H15 (290/295)' },
]

async function main() {
  console.log('Seeding Bowling Shoe products...')
  let created = 0, updated = 0

  for (const shoe of bowlingShoes) {
    const existing = await prisma.product.findUnique({ where: { sku: shoe.sku } })
    await prisma.product.upsert({
      where: { sku: shoe.sku },
      update: { name: shoe.name, category: 'BOWLING_SHOES' },
      create: {
        sku: shoe.sku,
        name: shoe.name,
        category: 'BOWLING_SHOES',
        unitPrice: 0,
        stockQuantity: 0,
        unit: 'EA',
      },
    })
    existing ? updated++ : created++
  }

  console.log(`Done: ${created} created, ${updated} updated`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
