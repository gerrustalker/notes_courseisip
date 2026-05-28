import * as monaco from "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/+esm";
import markdownit from "https://cdn.jsdelivr.net/npm/markdown-it@14.1.1/+esm";

let monacoeditor
const md = markdownit({
    html: false,
    breaks: true,
    linkify: true,
    langPrefix: "language-"
})

const notes = {...localStorage}
Object.entries(notes).forEach(([k, el]) => notes[k] = JSON.parse(el))
console.log(notes)

let SAVE_TIMEOUT, CURRENT_NOTE
const tagger = /#[\w\-А-Яа-я]+/gm
const save = (k, c) => {
    if(SAVE_TIMEOUT) {clearTimeout(SAVE_TIMEOUT); SAVE_TIMEOUT = null}
    c = c ?? monacoeditor?.getValue()
    if(c) notes[k].content = c, notes[k].tags = Array.from(new Set(c.match(tagger)))
    notes[k].update = Date.now()
    localStorage.setItem(k, JSON.stringify(notes[k]))
    reloadList()
}

const load = (k, el) => {
    if(SAVE_TIMEOUT && CURRENT_NOTE && notes[CURRENT_NOTE]) save(CURRENT_NOTE)
    noteeditor.replaceChildren()
    CURRENT_NOTE = k
    queryinput.value = ""

    noteeditor.classList.remove("nope")
    let h1 = document.createElement("h1")
        h1.textContent = el.title
        h1.contentEditable = "plaintext-only"
        h1.classList.add("title")
        h1.addEventListener("input", e => {
            el.title = e.target.textContent
            const h3 = noteslist.querySelector("span.note[note-id=\"" + k + "\"] h3")
            if(h3) h3.textContent = el.title;
            save(k)
        })
    noteeditor.appendChild(h1)
    let main = document.createElement("main")
    noteeditor.appendChild(main)
    let div = document.createElement("div")
        div.id = "monaco"
    noteeditor.appendChild(div)

    monacoeditor = monaco.editor.create(div, {
        language: "markdown",
        automaticLayout: true,
        theme: "vs-dark",
        value: el.content
    })

    if(el.content) main.innerHTML = md.render(el.content)
    hljs.highlightAll()

    monacoeditor.getModel().onDidChangeContent(() => {
        const c = monacoeditor.getValue()
        main.innerHTML = md.render(c)
        hljs.highlightAll()

        if(SAVE_TIMEOUT) clearTimeout(SAVE_TIMEOUT)
        SAVE_TIMEOUT = setTimeout(() => save(k, c), 1000)
    })
}
    
const unset = () => {
    let h1 = document.createElement("h1")
        h1.textContent = "ВЫБЕРИТЕ ЗАМЕТКУ"
    noteeditor.replaceChildren(h1)
    noteeditor.classList.add("nope")
    CURRENT_NOTE = null
}

const times = [
    [86400_000 * 365, "? лет назад"],
    [86400_000 * 30, "? месяцев назад"],
    [86400_000 * 7, "? недель назад"],
    [86400_000, "? дней назад"],
    [3600_000, "? часов назад"],
    [60_000, "? минут назад"],
    [1, "только что"],
]
const time = t => {
    const now = Date.now() - t
    let best
    for(const el of times) {
        if(now >= el[0]) {best = el; break}
    }
    best = best ?? times[times.length - 1]
    return best[1].replace("?", Math.floor(now / best[0]))
}

let OOPS
const reloadList = str => {
    str = str ?? (queryinput.value !== "" ? queryinput.value : null)
    const f = document.activeElement === queryinput
    noteslist.replaceChildren(notecreate)
    if(f) queryinput.focus()
    Object.entries(notes).toSorted(([, a], [, b]) => b.update - a.update).forEach(([k, el]) => {
        if(str && !el.title.includes(str) && (str[0] !== "#" || !el.tags.find(el => el.includes(str)))) return;
        let note = document.createElement("span")
            note.classList.add("note")
            note.setAttribute("note-id", k)
            note.addEventListener("click", () => {if(!OOPS) load(k, el); OOPS = null})
            let h3 = document.createElement("h3")
                h3.textContent = el.title
            note.appendChild(h3)
            let div = document.createElement("div")
                let tags = document.createElement("div")
                    el.tags?.forEach(el => {
                        let span = document.createElement("span")
                            span.textContent = el
                        tags.appendChild(span)
                    })
                div.appendChild(tags)
                let span = document.createElement("span")
                    span.textContent = time(el.update)
                    span.setAttribute("title", (new Date(el.update)).toString())
                div.appendChild(span)
                let btn = document.createElement("button")
                    btn.classList.add("delete")
                    btn.addEventListener("click", () => {
                        OOPS = true
                        if(confirm("Вы уверены, что хотите удалить эту записку?")) {
                            localStorage.removeItem(k)
                            delete notes[k]
                            reloadList()
                            console.log(CURRENT_NOTE, k, CURRENT_NOTE == k)
                            if(CURRENT_NOTE == k) unset()
                        }
                    })
                div.appendChild(btn)
            note.appendChild(div)
        noteslist.appendChild(note)
    })
}

queryinput.addEventListener("input", () => reloadList())
notecreate.addEventListener("submit", async e => {
    e.preventDefault()
    const data = new FormData(e.target)
    let title = data.get("queryinput")?.trim()
    if(title && title !== "") {
        const k = Array.from(new Uint8Array(await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${title}${Date.now()}`))))
            .map((b) => b.toString(16).padStart(2, "0"))
            .slice(0, 10).join("");
        notes[k] = {
            title,
            update: Date.now(),
        }
        save(k, "")
        load(k, notes[k])
        reloadList()
    }
})

const title = document.body.querySelector(".projectname h1")
title.style = "cursor: pointer"
title.addEventListener("click", () => {if(SAVE_TIMEOUT) save(CURRENT_NOTE); unset()})

reloadList()