/**
 * Script para gerar ícones PWA a partir do favicon.svg
 * Execução: node scripts/generate-pwa-icons.cjs
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCE_SVG = path.join(__dirname, '../public/favicon.svg');
const OUTPUT_DIR = path.join(__dirname, '../public/icons');

// Tamanhos dos ícones PWA
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Tamanhos dos ícones maskable (com padding para safe zone)
const MASKABLE_SIZES = [192, 512];

// Ícones de shortcut
const SHORTCUT_ICONS = [
  { name: 'shortcut-agenda', size: 96 },
  { name: 'shortcut-new', size: 96 },
  { name: 'shortcut-patients', size: 96 },
];

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Criada pasta: ${dir}`);
  }
}

async function generateIcon(size, outputPath) {
  await sharp(SOURCE_SVG)
    .resize(size, size)
    .png()
    .toFile(outputPath);
  console.log(`✅ Gerado: ${path.basename(outputPath)} (${size}x${size})`);
}

async function generateMaskableIcon(size, outputPath) {
  // Ícones maskable precisam de padding (safe zone é 80% do centro)
  const iconSize = Math.floor(size * 0.8);
  const padding = Math.floor((size - iconSize) / 2);

  // Criar fundo com a cor do tema (teal do favicon)
  const background = Buffer.from(
    `<svg width="${size}" height="${size}">
      <rect width="${size}" height="${size}" fill="#0d9488"/>
    </svg>`
  );

  // Redimensionar o ícone
  const icon = await sharp(SOURCE_SVG)
    .resize(iconSize, iconSize)
    .toBuffer();

  // Compor o ícone sobre o fundo
  await sharp(background)
    .composite([{ input: icon, left: padding, top: padding }])
    .png()
    .toFile(outputPath);

  console.log(`✅ Gerado (maskable): ${path.basename(outputPath)} (${size}x${size})`);
}

async function generateShortcutIcon(name, size, color) {
  const outputPath = path.join(OUTPUT_DIR, `${name}.png`);
  
  // Criar ícone com fundo colorido e cantos arredondados
  const background = Buffer.from(
    `<svg width="${size}" height="${size}">
      <rect width="${size}" height="${size}" rx="16" fill="${color}"/>
    </svg>`
  );

  const iconSize = Math.floor(size * 0.6);
  const padding = Math.floor((size - iconSize) / 2);

  const icon = await sharp(SOURCE_SVG)
    .resize(iconSize, iconSize)
    .toBuffer();

  await sharp(background)
    .composite([{ input: icon, left: padding, top: padding }])
    .png()
    .toFile(outputPath);

  console.log(`✅ Gerado (shortcut): ${name}.png (${size}x${size})`);
}

async function main() {
  console.log('🎨 Gerando ícones PWA para ClinicNest...\n');

  // Verificar se o SVG fonte existe
  if (!fs.existsSync(SOURCE_SVG)) {
    console.error('❌ Erro: favicon.svg não encontrado em public/');
    process.exit(1);
  }

  // Criar pasta de saída
  await ensureDir(OUTPUT_DIR);

  // Gerar ícones padrão
  console.log('\n📱 Ícones padrão:');
  for (const size of ICON_SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
    await generateIcon(size, outputPath);
  }

  // Gerar ícones maskable
  console.log('\n🎭 Ícones maskable:');
  for (const size of MASKABLE_SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon-maskable-${size}x${size}.png`);
    await generateMaskableIcon(size, outputPath);
  }

  // Gerar ícones de shortcut
  console.log('\n⚡ Ícones de shortcut:');
  const shortcutColors = {
    'shortcut-agenda': '#2563eb',    // Azul
    'shortcut-new': '#16a34a',       // Verde
    'shortcut-patients': '#7c3aed',  // Roxo
  };
  
  for (const shortcut of SHORTCUT_ICONS) {
    await generateShortcutIcon(
      shortcut.name, 
      shortcut.size, 
      shortcutColors[shortcut.name] || '#0d9488'
    );
  }

  // Copiar ícones para a raiz do public também (para compatibilidade)
  console.log('\n📋 Copiando ícones principais para public/:');
  
  const icon192 = path.join(OUTPUT_DIR, 'icon-192x192.png');
  const icon512 = path.join(OUTPUT_DIR, 'icon-512x512.png');
  
  if (fs.existsSync(icon192)) {
    fs.copyFileSync(icon192, path.join(__dirname, '../public/icon-192.png'));
    console.log('✅ Copiado: icon-192.png');
  }
  
  if (fs.existsSync(icon512)) {
    fs.copyFileSync(icon512, path.join(__dirname, '../public/icon-512.png'));
    console.log('✅ Copiado: icon-512.png');
  }

  console.log('\n🎉 Todos os ícones PWA foram gerados com sucesso!');
  console.log(`📂 Localização: ${OUTPUT_DIR}`);
}

main().catch(err => {
  console.error('❌ Erro ao gerar ícones:', err);
  process.exit(1);
});
