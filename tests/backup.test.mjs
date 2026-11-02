import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import fs from 'node:fs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tmp = path.join(root, '.tmp')
fs.mkdirSync(tmp, { recursive: true })
const outfile = path.join(tmp, 'backup-import.mjs')

await build({
  entryPoints: [path.join(root, 'src/lib/backup.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'silent',
  tsconfig: path.join(root, 'tsconfig.json'),
})

const { parseBackupFile } = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`)

let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`  ok  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${name}`)
    console.error(error)
  }
}

const flatNasBackup = {
  appConfig: {
    customTitle: '我的 FlatNas',
    background: 'https://images.example.com/wallpaper.jpg',
  },
  version: 3,
  groups: [
    {
      id: 'g1',
      title: '常用',
      isPublic: true,
      items: [
        {
          id: 'i1',
          title: 'GitHub',
          url: 'https://github.com/',
          lanUrl: 'http://192.168.1.10:3000/',
          icon: 'https://github.githubassets.com/favicons/favicon.svg',
          description1: '代码托管',
          openInNewTab: false,
          isPublic: true,
        },
        {
          id: 'i2',
          title: '内部服务',
          url: 'https://example.com/',
          lanUrl: 'http://10.0.0.2:8080/',
          icon: '/icon-cache/internal.webp',
          description1: '仅局域网',
          isPublic: false,
        },
      ],
    },
    {
      id: 'g2',
      title: '隐藏分组',
      isPublic: false,
      items: [
        {
          id: 'i3',
          title: 'Secret',
          url: 'https://secret.example.com/',
          icon: 'lucide:lock',
          isPublic: true,
        },
      ],
    },
  ],
  items: [
    { id: 'i1', title: 'GitHub', url: 'https://github.com/' },
    { id: 'i2', title: '内部服务', url: 'https://example.com/' },
    { id: 'i3', title: 'Secret', url: 'https://secret.example.com/' },
  ],
  widgets: [{ id: 'clock', type: 'clock', data: {} }],
  rssFeeds: [],
  rssCategories: [],
}

console.log('\nBackup import')

await test('imports FlatNas groups and cards into Hares groups/items', () => {
  const parsed = parseBackupFile(JSON.stringify(flatNasBackup))
  assert.equal(parsed.summary.source, 'flatnas')
  assert.equal(parsed.summary.groups, 2)
  assert.equal(parsed.summary.items, 3)
  assert.equal(parsed.data.groups[0].name, '常用')
  assert.equal(parsed.data.groups[1].hidden, true)
  assert.equal(parsed.data.config.siteName, '我的 FlatNas')
  assert.deepEqual(parsed.data.config.wallpaper, {
    type: 'url',
    url: 'https://images.example.com/wallpaper.jpg',
  })

  const github = parsed.data.items.find((item) => item.title === 'GitHub')
  assert.ok(github)
  assert.equal(github.groupId, parsed.data.groups[0].id)
  assert.equal(github.url, 'https://github.com/')
  assert.equal(github.lanUrl, 'http://192.168.1.10:3000/')
  assert.equal(github.description, '代码托管')
  assert.equal(github.openMode, 'self')
  assert.equal(github.icon, 'https://github.githubassets.com/favicons/favicon.svg')
  assert.equal(github.sort, 0)

  const internal = parsed.data.items.find((item) => item.title === '内部服务')
  assert.ok(internal)
  assert.equal(internal.hidden, true)
  assert.equal(internal.icon, '')
  assert.equal(internal.sort, 1)

  const secret = parsed.data.items.find((item) => item.title === 'Secret')
  assert.ok(secret)
  assert.equal(secret.openMode, 'new')
  assert.equal(secret.icon, 'lucide:lock')

  assert.ok(parsed.warnings.some((entry) => entry.includes('本地路径')))
  assert.ok(parsed.warnings.some((entry) => entry.includes('小组件')))
})

await test('imports a real FlatNas export without copying the duplicated flat items', () => {
  const shared = [
    {
      id: 'card-1',
      title: 'GitHub',
      url: 'https://github.com/',
      lanUrl: 'http://192.168.1.10:3000/',
      icon: 'data:image/png;base64,AAAA',
      description1: '代码托管',
      description2: '公开项目',
      isPublic: true,
    },
    {
      id: 'card-2',
      title: 'NAS 管理',
      url: '',
      backupUrls: [{ name: '备用', url: 'https://nas.example.com/' }],
      icon: 'icons/nas.png',
      color: 'bg-blue-50 text-blue-600',
      isPublic: false,
    },
  ]
  const parsed = parseBackupFile(
    JSON.stringify({
      items: [...shared, { id: 'card-3', title: '独立卡片', url: 'https://standalone.example.com/' }],
      widgets: [{ id: 'clock', type: 'clock', data: {} }],
      appConfig: {
        customTitle: '家庭导航',
        customWallpaper: '',
        wallpaperConfig: { type: 'api', url: 'https://images.example.com/bg.jpg' },
      },
      groups: [{ id: 'g-real', title: '常用', isPublic: true, items: shared }],
      rssFeeds: [],
      rssCategories: [],
    }),
  )

  assert.equal(parsed.summary.source, 'flatnas')
  assert.equal(parsed.summary.groups, 2)
  assert.equal(parsed.summary.items, 3)
  assert.equal(parsed.data.groups[0].name, '常用')
  assert.equal(parsed.data.groups[1].name, '未分组卡片')
  assert.equal(parsed.data.config.siteName, '家庭导航')
  assert.deepEqual(parsed.data.config.wallpaper, {
    type: 'url',
    url: 'https://images.example.com/bg.jpg',
  })

  const github = parsed.data.items.find((item) => item.title === 'GitHub')
  assert.ok(github)
  assert.equal(github.description, '代码托管 · 公开项目')
  assert.equal(github.icon, 'data:image/png;base64,AAAA')
  assert.equal(github.groupId, parsed.data.groups[0].id)

  const nas = parsed.data.items.find((item) => item.title === 'NAS 管理')
  assert.ok(nas)
  assert.equal(nas.url, 'https://nas.example.com/')
  assert.equal(nas.icon, '')
  assert.equal(nas.iconColor, '')
  assert.equal(nas.hidden, true)

  const standalone = parsed.data.items.find((item) => item.title === '独立卡片')
  assert.ok(standalone)
  assert.equal(standalone.groupId, parsed.data.groups[1].id)
  assert.ok(parsed.warnings.some((entry) => entry.includes('补充了 1 张')))
  assert.equal(parsed.warnings.some((entry) => entry.includes('忽略顶层重复')), false)
})

await test('imports a flat FlatNas item list into a default group', () => {
  const parsed = parseBackupFile(
    JSON.stringify({
      appConfig: { customTitle: 'Flat' },
      items: [
        { id: 'a', title: 'A', url: 'https://a.example.com/' },
        { id: 'b', title: 'B', url: 'https://b.example.com/' },
      ],
      widgets: [],
    }),
  )
  assert.equal(parsed.summary.groups, 1)
  assert.equal(parsed.data.groups[0].name, 'FlatNas 导入')
  assert.equal(parsed.data.items.length, 2)
  assert.ok(parsed.data.items.every((item) => item.groupId === parsed.data.groups[0].id))
})

await test('falls back to the FlatNas bookmark widget when there are no nav cards', () => {
  const parsed = parseBackupFile(
    JSON.stringify({
      appConfig: { customTitle: 'Bookmarks' },
      groups: [],
      items: [],
      widgets: [
        {
          id: 'bookmark',
          type: 'bookmark',
          data: [
            {
              id: 'cat',
              title: '收藏',
              children: [
                { id: 'l1', title: 'Example', url: 'https://example.com/' },
                {
                  id: 'sub',
                  title: '子分类',
                  children: [{ id: 'l2', title: 'Nested', url: 'https://nested.example.com/' }],
                },
              ],
            },
          ],
        },
      ],
    }),
  )
  assert.equal(parsed.summary.source, 'flatnas')
  assert.equal(parsed.summary.items, 2)
  assert.ok(parsed.data.groups.some((group) => group.name === '收藏'))
  assert.ok(parsed.data.groups.some((group) => group.name === '收藏 / 子分类'))
})

await test('ships an importable FlatNas sample backup', () => {
  const text = fs.readFileSync(path.join(root, 'examples/flatnas-backup-sample.json'), 'utf8')
  const parsed = parseBackupFile(text)
  assert.equal(parsed.summary.source, 'flatnas')
  assert.equal(parsed.summary.groups, 4)
  assert.equal(parsed.summary.items, 8)
  assert.ok(parsed.data.groups.some((group) => group.name === '未分组卡片'))
  assert.ok(parsed.data.items.some((item) => item.title === '独立卡片'))
  assert.ok(parsed.data.items.some((item) => item.url === 'https://nas.example.com/'))
  assert.ok(parsed.warnings.some((entry) => entry.includes('本地路径')))
})

await test('imports Sun-Panel icon groups and cards', () => {
  const parsed = parseBackupFile(
    JSON.stringify({
      version: 1,
      appName: 'Sun-Panel-Config',
      exportTime: '2026-11-01 19:00:00',
      appVersion: '1.8.1',
      md5: 'ignored',
      icons: [
        {
          title: '第二组',
          sort: 2,
          cardStyle: { style: 1 },
          children: [
            {
              icon: { itemType: 3, text: 'simple-icons:github', backgroundColor: '' },
              sort: 2,
              title: 'GitHub',
              url: 'https://github.com/',
              lanUrl: 'http://192.168.1.10:3000/',
              description: '代码托管',
              openMethod: 1,
            },
            {
              icon: { itemType: 2, src: '/upload/local-icon.png', backgroundColor: '' },
              sort: 1,
              title: '本地图标',
              url: 'https://local.example.com/',
              openMethod: 3,
            },
          ],
        },
        {
          title: '第一组',
          sort: 1,
          cardStyle: { style: 0 },
          children: [
            {
              icon: { itemType: 1, text: '😀', backgroundColor: '#2a2a2a6b' },
              sort: 1,
              title: 'Emoji',
              url: 'https://emoji.example.com/',
              openMethod: 2,
            },
            {
              icon: {
                itemType: 2,
                src: 'https://cdn.example.com/icon.svg',
                backgroundColor: '',
              },
              sort: 2,
              title: '远程图标',
              url: 'https://remote.example.com/',
              openMethod: 2,
            },
          ],
        },
      ],
    }),
  )

  assert.equal(parsed.summary.source, 'sun-panel')
  assert.equal(parsed.summary.groups, 2)
  assert.equal(parsed.summary.items, 4)
  assert.equal(parsed.summary.exportedAt, '2026-11-01T19:00:00')
  assert.equal(parsed.data.groups[0].name, '第一组')
  assert.equal(parsed.data.groups[0].style, 'card')
  assert.equal(parsed.data.groups[1].name, '第二组')
  assert.equal(parsed.data.groups[1].style, 'icon')

  const github = parsed.data.items.find((item) => item.title === 'GitHub')
  assert.ok(github)
  assert.equal(github.icon, 'simple-icons:github')
  assert.equal(github.lanUrl, 'http://192.168.1.10:3000/')
  assert.equal(github.openMode, 'self')
  assert.equal(github.sort, 1)

  const local = parsed.data.items.find((item) => item.title === '本地图标')
  assert.ok(local)
  assert.equal(local.icon, '')
  assert.equal(local.openMode, 'new')
  assert.equal(local.sort, 0)

  const emoji = parsed.data.items.find((item) => item.title === 'Emoji')
  assert.ok(emoji)
  assert.equal(emoji.icon, '😀')
  assert.equal(emoji.openMode, 'new')

  const remote = parsed.data.items.find((item) => item.title === '远程图标')
  assert.ok(remote)
  assert.equal(remote.icon, 'https://cdn.example.com/icon.svg')

  assert.ok(parsed.warnings.some((entry) => entry.includes('本地上传图片')))
  assert.ok(parsed.warnings.some((entry) => entry.includes('站内浮层')))
})

await test('ships an importable Sun-Panel sample backup', () => {
  const text = fs.readFileSync(
    path.join(root, 'examples/sun-panel-backup-sample.json'),
    'utf8',
  )
  const parsed = parseBackupFile(text)
  assert.equal(parsed.summary.source, 'sun-panel')
  assert.equal(parsed.summary.groups, 3)
  assert.equal(parsed.summary.items, 6)
  assert.equal(parsed.summary.exportedAt, '2026-11-01T19:00:00')
  assert.ok(parsed.data.groups.every((group) => group.style === 'card'))
  assert.ok(
    parsed.data.items.some(
      (item) =>
        item.title === 'Google' &&
        item.icon === 'https://www.google.com/favicon.ico' &&
        item.description === '全球最大的搜索引擎',
    ),
  )
  assert.ok(
    parsed.data.items.some(
      (item) =>
        item.title === 'qBittorrent' &&
        item.lanUrl === 'http://192.168.1.100:8080',
    ),
  )
})

await test('detects Sun-Panel exports without an appName marker', () => {
  const parsed = parseBackupFile(
    JSON.stringify({
      icons: [
        {
          title: '常用',
          sort: 1,
          children: [
            {
              title: 'Example',
              url: 'https://example.com/',
              icon: { itemType: 2, src: 'https://example.com/favicon.ico' },
            },
          ],
        },
      ],
    }),
  )
  assert.equal(parsed.summary.source, 'sun-panel')
  assert.equal(parsed.summary.items, 1)
})

await test('rejects a Sun-Panel file without any cards', () => {
  assert.throws(
    () =>
      parseBackupFile(
        JSON.stringify({
          appName: 'Sun-Panel-Config',
          version: 1,
          icons: [],
        }),
      ),
    /Sun-Panel 配置中没有找到/,
  )
})

await test('still accepts native Hares-Panel backups', () => {
  const parsed = parseBackupFile(
    JSON.stringify({
      app: 'hares-panel',
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      config: { siteName: 'Hares' },
      groups: [{ id: 'g', name: 'G', sort: 0 }],
      items: [
        {
          id: 'i',
          groupId: 'g',
          title: 'I',
          sort: 0,
        },
      ],
      searchEngines: [],
      gallery: [],
    }),
  )
  assert.equal(parsed.summary.source, 'hares-panel')
  assert.equal(parsed.data.groups.length, 1)
  assert.equal(parsed.data.items.length, 1)
  assert.equal(parsed.warnings.length, 0)
})

await test('rejects unrelated JSON files', () => {
  assert.throws(
    () => parseBackupFile(JSON.stringify({ hello: 'world' })),
    /无法识别的备份文件/,
  )
})

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exitCode = 1
