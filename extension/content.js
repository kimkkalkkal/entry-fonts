{
  const TOAST_TITLE = '엔트리폰트'
  const FUNC_NAME = '엔트리폰트 적용하기'
  const FONT_FAMILY_PREFIX = '__entryFonts_'
  const VariableNames = {
    FONT_LIST: '엔트리폰트',
    ENABLED_VARIABLE: '엔트리폰트사용',
  }

  let currentFontFaces = []
  let entryWindow, Entry

  window.addEventListener('message', (event) => {
    if (event.data.type === 'entryFontLoad') {
      if (!entryWindow || !Entry) {
        entryWindow = 'Entry' in window ? window : window.frames[0]
        Entry = entryWindow?.Entry
      }
      loadFeatures()
    }
  })

  const tryLoad = () => {
    entryWindow = 'Entry' in window ? window : window.frames[0]
    Entry = entryWindow?.Entry

    if (!entryWindow || !Entry || !Entry.isLoadProject) {
      setTimeout(tryLoad, 3000)
      return
    }

    loadFeatures()
  }

  tryLoad()

  async function loadFeatures() {
    if (!Entry) return

    const enabledVariable = Entry.variableContainer.getVariableByName(
      VariableNames.ENABLED_VARIABLE
    )
    if ('Entry' in window) {
      Entry.addEventListener('run', () => {
        enabledVariable.setValue('1')
      })
    } else {
      enabledVariable.setValue('1')
    }

    const fontEntries = getFontEntriesFromList()
    if (!fontEntries) return

    Entry.toast.success(TOAST_TITLE, '로딩중입니다', false)

    const allFunctionEntries = Object.entries(Entry.variableContainer.functions_)
    const [, changeFontFunc] = allFunctionEntries.find(([, func]) =>
      func.block.template.includes(FUNC_NAME)
    ) ?? []

    if (!changeFontFunc) {
      Entry.toast.warning(
        TOAST_TITLE,
        '폰트 적용 함수를 찾을 수 없습니다\n폰트 적용 함수를 생성 후 다시 로딩해주세요',
        false
      )
      return
    }
    replaceChangeFontFunc(changeFontFunc)

    currentFontFaces.forEach((fontFace) => entryWindow.document.fonts.delete(fontFace))

    const fontPromises = []
    
    for (const fontEntry of fontEntries) {
      const [index, [fontName, url]] = fontEntry
      if (fontEntry.length !== 2 || !url || !URL.canParse(url)) {
        Entry.toast.alert(
          TOAST_TITLE,
          `${VariableNames.FONT_LIST} ${index}번째 항목의 형식이 올바르지 않습니다`,
          false
        )
        return
      }

      const fontFace = new FontFace(`${FONT_FAMILY_PREFIX}${fontName}`, `url("${url}")`)
      entryWindow.document.fonts.add(fontFace)
      document.fonts.add(fontFace)

      fontPromises.push(
        fontFace
          .load()
          .then(() => {
            currentFontFaces.push(fontFace)
            Entry.toast.success(TOAST_TITLE, `폰트 로딩 완료: ${fontName}`, false)
          })
          .catch(() => {
            Entry.toast.alert(
              TOAST_TITLE,
              `폰트 로딩 실패: ${fontName}\n폰트 URL을 확인해 주세요`,
              false
            )
          })
      )
    }

    await Promise.allSettled(fontPromises)
    
    Entry.toast.success(TOAST_TITLE, '로딩 완료', false)

    Entry.addEventListener('run', () => {
      Entry.variableContainer
        .getVariableByName(VariableNames.LOADED_VARIABLE)
        ?.setValue('1')
    })
  }

  function getFontEntriesFromList() {
    const fontList = Entry.variableContainer.getListByName(VariableNames.FONT_LIST)
    if (!fontList) return
    return fontList.getArray().map(({ data }) => data.split(' ')).entries()
  }

  function replaceChangeFontFunc(func) {
    if (!func.block?.params.find((param) => param.accept === 'string' && param.type === 'Block')) {
      Entry.toast.alert(
        TOAST_TITLE,
        '폰트 적용 함수의 형식이 올바르지 않습니다',
        false
      )
      return
    }

    Entry.block[`func_${func.id}`].func = function(sprite, script) {
      if (sprite.type !== 'textBox') {
        Entry.toast.alert(TOAST_TITLE, '글상자에서만 사용 가능합니다', false)
        return
      }

      const fontNameOrIndex = script.getParam(0)
      let fontName = isNaN(fontNameOrIndex)
        ? fontNameOrIndex.trim()
        : getFontEntriesFromList().find((_, index) => index === +fontNameOrIndex - 1)?.[1]?.[0]

      let fontFamily = `${FONT_FAMILY_PREFIX}${fontName}`

      if (!currentFontFaces.find((fontFace) => fontFace.family === fontFamily)) {
        Entry.toast.alert(TOAST_TITLE, `올바르지 않은 폰트 이름: ${fontNameOrIndex}`, false)
        return
      }

      sprite.setFontWithLog(`${sprite.getFontSize()} ${fontFamily}`, false)
      return script.callReturn()
    }
    Entry.toast.success(TOAST_TITLE, '폰트 적용 함수 로딩 완료', false)
  }
}