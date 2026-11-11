import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed de datos para Postres App...");

  // Limpiar datos existentes en orden inverso por relaciones
  await prisma.paymentRecord.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  // 1. Categorías Gastronómicas
  const tortas = await prisma.category.create({
    data: {
      name: "Tortas & Pasteles",
      slug: "tortas-pasteles",
      description: "Tortas artesanales para ocasiones especiales o compartir.",
      icon: "Cake",
      order: 1,
    },
  });

  const individuales = await prisma.category.create({
    data: {
      name: "Postres Individuales",
      slug: "postres-individuales",
      description: "Vasos, mousses y tartaletas para disfrutar en cualquier momento.",
      icon: "CupSoda",
      order: 2,
    },
  });

  const galletas = await prisma.category.create({
    data: {
      name: "Galletas & Bocadillos",
      slug: "galletas-bocadillos",
      description: "Galletas horneadas diariamente, brownies y alfajores.",
      icon: "Cookie",
      order: 3,
    },
  });

  const especiales = await prisma.category.create({
    data: {
      name: "Línea Saludable & Sin Gluten",
      slug: "saludable-sin-gluten",
      description: "Opciones sin azúcar añadida y aptas para celíacos.",
      icon: "HeartHandshake",
      order: 4,
    },
  });

  // 2. Catálogo Inicial de Postres
  const products = [
    {
      categoryId: tortas.id,
      name: "Tarta Tres Leches Tradicional",
      slug: "tarta-tres-leches-tradicional",
      description: "Bizcocho esponjoso bañado en nuestra infusión artesanal de tres leches, coronado con merengue suizo dorado y canela.",
      price: 135000, // RD$ 1,350.00
      portions: "10 a 12 porciones",
      allergens: JSON.stringify(["Lácteos", "Gluten", "Huevo"]),
      isAvailable: true,
      prepTimeHours: 24,
      imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&auto=format&fit=crop&q=80",
    },
    {
      categoryId: tortas.id,
      name: "Cheesecake de Frutos Rojos Silvestres",
      slug: "cheesecake-frutos-rojos",
      description: "Base crocante de galleta de mantequilla con suave crema de queso y reducción casera de frambuesas y moras.",
      price: 160000, // RD$ 1,600.00
      portions: "10 a 12 porciones",
      allergens: JSON.stringify(["Lácteos", "Gluten", "Huevo"]),
      isAvailable: true,
      prepTimeHours: 24,
      imageUrl: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=800&auto=format&fit=crop&q=80",
    },
    {
      categoryId: tortas.id,
      name: "Torta Húmeda de Cacao Puro 70%",
      slug: "torta-humeda-cacao-puro",
      description: "Intensa torta de chocolate negro rellena de ganache sedoso y cobertura de chocolate semiamargo.",
      price: 150000, // RD$ 1,500.00
      portions: "8 a 10 porciones",
      allergens: JSON.stringify(["Lácteos", "Gluten", "Huevo"]),
      isAvailable: true,
      prepTimeHours: 24,
      imageUrl: "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?w=800&auto=format&fit=crop&q=80",
    },
    {
      categoryId: individuales.id,
      name: "Tiramisú Clásico en Copa",
      slug: "tiramisu-clasico-copa",
      description: "Bizcochos soletilla embebidos en café expreso recién colado y licor fino, intercalados con crema de mascarpone y cacao.",
      price: 32000, // RD$ 320.00
      portions: "Individual (220g)",
      allergens: JSON.stringify(["Lácteos", "Gluten", "Huevo"]),
      isAvailable: true,
      prepTimeHours: 4,
      imageUrl: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&auto=format&fit=crop&q=80",
    },
    {
      categoryId: individuales.id,
      name: "Mousse de Maracuyá Criollo",
      slug: "mousse-maracuya-criollo",
      description: "Equilibrio cítrico y dulce en mousse aireada con coulis natural de chinola fresca.",
      price: 28000, // RD$ 280.00
      portions: "Individual (200g)",
      allergens: JSON.stringify(["Lácteos", "Huevo"]),
      isAvailable: true,
      prepTimeHours: 4,
      imageUrl: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=800&auto=format&fit=crop&q=80",
    },
    {
      categoryId: galletas.id,
      name: "Caja de Galletas Red Velvet (6 uds)",
      slug: "caja-galletas-red-velvet",
      description: "Galletas estilo Nueva York con trozos de chocolate blanco belga y corazón de queso crema.",
      price: 45000, // RD$ 450.00
      portions: "Caja de 6 unidades grandes",
      allergens: JSON.stringify(["Lácteos", "Gluten", "Huevo"]),
      isAvailable: true,
      prepTimeHours: 2,
      imageUrl: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&auto=format&fit=crop&q=80",
    },
    {
      categoryId: especiales.id,
      name: "Brownie Vegano Sin Gluten de Almendras",
      slug: "brownie-vegano-sin-gluten",
      description: "Elaborado con harina de almendras, aceite de coco virgen y chocolate amargo 80%. Apto celíacos y veganos.",
      price: 35000, // RD$ 350.00
      portions: "Individual (180g)",
      allergens: JSON.stringify(["Frutos Secos"]),
      isAvailable: true,
      prepTimeHours: 4,
      imageUrl: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&auto=format&fit=crop&q=80",
    },
  ];

  for (const item of products) {
    await prisma.product.create({ data: item });
  }

  console.log(`Seed completado con éxito: 4 categorías y ${products.length} postres registrados.`);
}

main()
  .catch((e) => {
    console.error("Error durante el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
