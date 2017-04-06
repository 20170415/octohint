import * as ts from 'typescript'
import './style.css'

const CLASS_NAME = 'intelli-github'
const CLASS_NAME_ITEM = `${CLASS_NAME}-item`
const CLASS_NAME_DEFINITION = `${CLASS_NAME}-definition`
const CLASS_NAME_USAGE = `${CLASS_NAME}-usage`
const FILE_NAME = 'test.ts'

export function main() {
  const $content = document.querySelector('.file')

  if (!$content) {
    return
  }

  const $header = $content.querySelector('.file-header')
  const $table = $content.querySelector('table')
  const $test = $table.querySelector('span')

  const $firstLineGutter = $table.querySelector('#L1')
  const $firstLine = $table.querySelector('#LC1')

  // Use `getBoundingClientRect` instead of `offsetWidth/Height` to get accurate width and height
  // https://developer.mozilla.org/en-US/docs/Web/API/CSS_Object_Model/Determining_the_dimensions_of_elements
  const FONT_WIDTH = $test.getBoundingClientRect().width / $test.innerText.length
  const FILE_HEAD_HEIGHT = $header.getBoundingClientRect().height
  const GUTTER_WIDTH = $firstLineGutter.getBoundingClientRect().width + parseInt(getComputedStyle($firstLine).paddingLeft, 10)
  const LINE_HEIGHT = $firstLine.getBoundingClientRect().height

  function getPosition(e: MouseEvent, $dom: HTMLElement) {
    const rect = $dom.getBoundingClientRect()
    // console.log(e.clientX, e.clientY, rect)
    return {
      x: Math.floor((e.clientX - rect.left - GUTTER_WIDTH) / FONT_WIDTH),
      y: Math.floor((e.clientY - rect.top) / LINE_HEIGHT)
    }
  }

  // Clear all item
  function clear() {
    const $container = <HTMLElement>document.querySelector(`.${CLASS_NAME}`)
    if ($container) {
      $container.innerHTML = ''
    }
  }

  interface DrawData {
    range: ts.LineAndCharacter,
    width: number
  }

  // TODO: Fix overflow when length is large
  // TODO: Fix position when horizontal scroll
  function draw(datas: DrawData[], className: string) {
    const $c = <HTMLElement>document.querySelector(`.${CLASS_NAME}`)

    let $container: HTMLElement
    if ($c) {
      $container = $c
    } else {
      $container = document.createElement('div')
      $container.className = CLASS_NAME
    }

    datas.forEach(data => {
      const $mask = document.createElement('div')

      // Set style
      $mask.className = `${CLASS_NAME_ITEM} ${className}`
      $mask.style.width = `${data.width * FONT_WIDTH}px`
      $mask.style.top = `${data.range.line * LINE_HEIGHT + FILE_HEAD_HEIGHT}px`
      $mask.style.left = `${data.range.character * FONT_WIDTH + GUTTER_WIDTH}px`

      $container.appendChild($mask)
    })

    // Append to webpage
    if (!$c) {
      $header.appendChild($container)
    }
  }

  function drawDefinition(data: DrawData[]) {
    return draw(data, CLASS_NAME_DEFINITION)
  }

  function drawUsage(data: DrawData[]) {
    return draw(data, CLASS_NAME_USAGE)
  }

  // FIXME: Replace tab with 8 space, GitHub's tab size
  const code: string = $table.innerText.replace(/\t/g, '        ')

  // https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API#incremental-build-support-using-the-language-services
  const servicesHost: ts.LanguageServiceHost = {
    getScriptFileNames: () => [FILE_NAME],
    getScriptVersion: () => '0', // Version matters not here since no file change
    getScriptSnapshot: (fileName) => {
      return fileName === FILE_NAME ? ts.ScriptSnapshot.fromString(code) : undefined
    },
    getCurrentDirectory: () => '/',
    getCompilationSettings: () => ({ module: ts.ModuleKind.CommonJS }),
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
  }

  // Create the language service files
  const services: ts.LanguageService = ts.createLanguageService(servicesHost, ts.createDocumentRegistry())
  const program: ts.Program = services.getProgram()
  const source: ts.SourceFile = program.getSourceFile(FILE_NAME)

  $table.addEventListener('click', function (e) {
    clear()

    const position = getPosition(e, $table)
    const pos: number = source.getPositionOfLineAndCharacter(position.y, position.x)

    const infos: ts.DefinitionInfo[] = services.getDefinitionAtPosition(FILE_NAME, pos)
    // console.log(infos)
    if (infos && infos.length) {
      const info = infos[0]
      const range: ts.LineAndCharacter = source.getLineAndCharacterOfPosition(info.textSpan.start)

      // If meta key is pressed, go to definition
      if (e.metaKey) {
        window.location.hash = `#L${range.line + 1}`
      }
    }

    // TODO: Exclude click event triggered by selecting text
    // https://stackoverflow.com/questions/10390010/jquery-click-is-triggering-when-selecting-highlighting-text
    // if (window.getSelection().toString()) {
    //   return
    // }

    const occurrences: ts.ReferenceEntry[] = services.getOccurrencesAtPosition(FILE_NAME, pos)
    if (occurrences) {
      const data = occurrences.map(occurrence => ({
        range: source.getLineAndCharacterOfPosition(occurrence.textSpan.start),
        width: occurrence.textSpan.length
      }))
      drawUsage(data)
    }
  })
}
