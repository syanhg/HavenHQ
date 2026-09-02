#!/usr/bin/env python3
"""Build /docs.

Eight pages that share one shell, one sidebar and one search index. The shell
is here rather than copied into eight files because a sidebar listing eight
pages, pasted eight times, is eight places to forget when a ninth arrives.

What it writes is plain HTML with no build step at serve time, the same as the
rest of the site: run this, commit the output, GitHub Pages serves it.

    python3 scripts/docs.py
"""

import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs')

# --- the pages ---------------------------------------------------------------
#
# slug '' is /docs/ itself. Every other slug is a directory index, so /docs/canvas
# resolves without config, the way /terms and /privacy already do.
#
# 'nav' is what the sidebar calls it, which is shorter than the title it wears at
# the top of its own page: a list wants a label, a page wants a name.

PAGES = [
{
 'slug': '',
 'nav': 'Overview',
 'group': 'Start',
 'title': 'Using Soffo',
 'lede': 'Soffo is a canvas where you and your agents stand in front of the same '
         'work. This guide covers the gestures, who you can address, and what '
         'happens after you ask for something.',
 'body': '''
<section id="what">
  <h2>What Soffo is</h2>
  <p>A workspace with coordinates instead of a scroll. Everything you make sits somewhere on an open plane: notes, tables, sheets, drawings, web pages, running apps. Everyone with the canvas open sees the same marks in the same places, as they appear.</p>
  <p>An agent here is not a bot you message and wait on. It has a cursor with its own name and colour, it moves, and what it writes lands on the canvas while it is writing. There is no chat pane it answers from, because there is no chat.</p>
  <p>Two kinds live here. <b>Soffo</b> is the resident: on every canvas, never leaves, and who you reach when you ask without naming anyone. The rest are yours, and you bring them: the coding agent you already pay for, and colleagues you write briefs for.</p>
</section>

<section id="first">
  <h2>Your first canvas</h2>
  <ol class="steps">
    <li><p><b>Open the workspace.</b> <a href="https://app.getsoffo.com">app.getsoffo.com</a> in a browser is the whole product. The Mac app adds one thing a browser cannot do: reach the coding agents installed on your machine. If you want to run Claude Code, Codex or Cursor from the canvas, you want the Mac app.</p></li>
    <li><p><b>Look before you type.</b> A canvas opens in drag mode every time, whatever you were doing last session. Drag or scroll to move around it, pinch or <span class="key">&#8984;</span><span class="key">+</span> to zoom.</p></li>
    <li><p><b>Type <code>/</code>.</b> That is the whole command surface. There is no toolbar and no palette. The menu that opens is everything the canvas does.</p></li>
    <li><p><b>Write, and put a name in it.</b> Press <span class="key">&#8997;</span><span class="key">W</span>, click anywhere, type. An <code>@</code> in what you have written is how you address somebody: <code>@soffo what is wrong with this plan</code>. Soffo walks over and answers beside you.</p></li>
    <li><p><b>Turn the agents on.</b> A new account starts with them switched off, so your first canvas is one you can draw on with nothing running. <a href="/docs/account/">Settings</a> is where you bring an API key or start a plan.</p></li>
  </ol>
</section>
'''},

{
 'slug': 'canvas',
 'nav': 'The canvas',
 'group': 'Start',
 'title': 'The canvas',
 'lede': 'One menu, six modes and three objects. This is everything the plane '
         'itself does, before any agent is involved.',
 'body': '''
<section id="menu">
  <h2>The &ldquo;/&rdquo; menu</h2>
  <p>Type <code>/</code> anywhere. What opens is short, and it is the only menu you have to learn.</p>
  <p>Two kinds of thing are on it. A <b>mode</b> changes what a click does and you stay in it, like a pen you are holding. An <b>action</b> puts one object down and leaves you where you were.</p>

  <h3>Modes</h3>
  <dl class="cmds">
    <dt>/drag</dt><dd class="k"><span class="key">&#8997;</span><span class="key">V</span></dd><dd>Move the plane and pick things up. Where every canvas opens.</dd>
    <dt>/write</dt><dd class="k"><span class="key">&#8997;</span><span class="key">W</span></dd><dd>Click to leave a block of text. Markdown works.</dd>
    <dt>/build</dt><dd class="k"><span class="key">&#8997;</span><span class="key">B</span></dd><dd>Ask for something that runs rather than something to read.</dd>
    <dt>/draw</dt><dd class="k"><span class="key">&#8997;</span><span class="key">D</span></dd><dd>Ink on the plane. Agents can see it.</dd>
    <dt>/erase</dt><dd class="k"><span class="key">&#8997;</span><span class="key">E</span></dd><dd>Take things off it.</dd>
  </dl>

  <h3>Actions</h3>
  <dl class="cmds">
    <dt>/table</dt><dd class="k"><span class="key">&#8997;</span><span class="key">T</span></dd><dd>A table, here.</dd>
    <dt>/shell</dt><dd class="k"><span class="key">&#8997;</span><span class="key">S</span></dd><dd>A sheet you write on, with a prompt box at its foot.</dd>
    <dt>/browser</dt><dd class="k"><span class="key">&#8997;</span><span class="key">P</span></dd><dd>A live web page, at the size of a window.</dd>
  </dl>

  <div class="note">
    <p>The modifier is Option rather than Command on purpose. Three of those letters belong to the browser and not to the page: <span class="key">&#8984;</span><span class="key">W</span> closes the tab whatever we have to say about it. On Option, every mode keeps the letter its own name gave it.</p>
    <p><code>/ask</code> is a mode too and still works typed out, but it is not on the menu. Writing a block with an <code>@</code> in it is already that gesture.</p>
  </div>
</section>

<section id="writing">
  <h2>Writing</h2>
  <p>A block is the unit of everything here. Press <span class="key">&#8997;</span><span class="key">W</span>, click, type. Escape or a click away leaves it. It saves as you go, and it is on everyone else&rsquo;s screen before you finish the word.</p>
  <p>Three characters open a menu while you write:</p>
  <ul>
    <li><code>@</code> addresses somebody: Soffo, a colleague you built, a coding agent you attached, or a connected app. All four are in one list, because from where you are typing there is no difference worth drawing.</li>
    <li><code>#</code> points at a body of text: a named section of this canvas, or anything on the <a href="/docs/context/#contexts">context shelf</a>.</li>
    <li><code>/</code> opens the command menu from inside a block.</li>
  </ul>
  <p>What someone said is theirs. You cannot rewrite a message you did not write, or anything an agent wrote, however much of the canvas you own. An answer that anyone present could quietly reword is one nobody in the room can rely on.</p>

  <h3>Sections</h3>
  <p>Name a region of the canvas and it becomes something you can point at. After that <code>#thatname</code> in any sentence hands its whole contents to whoever you are addressing, without you describing where it is.</p>
</section>

<section id="objects">
  <h2>Tables, sheets and pages</h2>
  <p>Three things you put down rather than three modes you enter.</p>
  <p>A <b>table</b> (<span class="key">&#8997;</span><span class="key">T</span>) is a grid on the plane. Agents read and fill them, so it is the right shape for anything you want back as rows.</p>
  <p>A <b>sheet</b> (<span class="key">&#8997;</span><span class="key">S</span>) is a document with a prompt box at the bottom. Use it when the work wants its own page: a draft, a spec, a summary that keeps growing. The prompt box takes an <code>@</code> the same way a block does.</p>
  <p>A <b>page</b> (<span class="key">&#8997;</span><span class="key">P</span>) is a real browser on the canvas. Not a screenshot and not a link, but a window-sized page you can use, sitting beside the work it is about, which an agent can be pointed at.</p>
</section>

<section id="drawing">
  <h2>Drawing and erasing</h2>
  <p>Press <span class="key">&#8997;</span><span class="key">D</span> and draw. Ink is part of the canvas rather than a layer over it, so an agent looking at the canvas sees your circles and arrows the same way it sees the text.</p>
  <p>That makes it the natural thing to do to an app you asked for and do not like: circle the part that is wrong and say what you want instead. Soffo asks the running app what is actually at the place you circled, so the note names the element rather than a rectangle.</p>
  <p><span class="key">&#8997;</span><span class="key">E</span> erases. Ink belongs to the canvas rather than to whoever laid it down, so there is no erasing only your own.</p>
</section>

<section id="moving">
  <h2>Moving around</h2>
  <dl class="cmds plain">
    <dt>Zoom in</dt><dd class="k"><span class="key">&#8984;</span><span class="key">+</span></dd><dd>Closer.</dd>
    <dt>Zoom out</dt><dd class="k"><span class="key">&#8984;</span><span class="key">&minus;</span></dd><dd>Further out.</dd>
    <dt>Zoom to fit</dt><dd class="k"><span class="key">&#8679;</span><span class="key">1</span></dd><dd>Everything on the canvas at once.</dd>
    <dt>Zoom to selection</dt><dd class="k"><span class="key">&#8679;</span><span class="key">2</span></dd><dd>Just what you have picked.</dd>
    <dt>Actual size</dt><dd class="k"><span class="key">&#8984;</span><span class="key">0</span></dd><dd>Back to 100%.</dd>
    <dt>Your panel</dt><dd class="k"><span class="key">&#8997;</span><span class="key">K</span></dd><dd>The list and your colleagues, on the right.</dd>
  </dl>
  <p>Everyone here has a cursor and a colour, and there are eight of them. Soffo wears the first and nobody else is given it, so the one body on every canvas is the one you recognise without reading the label.</p>
</section>
'''},

{
 'slug': 'agents',
 'nav': 'Working with agents',
 'group': 'Agents',
 'title': 'Working with agents',
 'lede': 'How to hand work over, what it looks like while it runs, and what you '
         'get back.',
 'body': '''
<section id="asking">
  <h2>Asking</h2>
  <p>Write a block with a name in it. That is the whole gesture.</p>
  <p><code>@soffo</code> reaches the resident. <code>@claude</code> or <code>@codex</code> reaches a coding agent you attached. A name you chose reaches a colleague you built. <code>@gmail</code> or <code>@notion</code> reaches an app you connected. One character, and you do not have to know which kind you are reaching for.</p>
  <p>What happens next is on the plane. A cursor moves to clear space near what you asked about and the answer is written there as it arrives, in that agent&rsquo;s colour with its name on it. You can keep working while it does.</p>
  <p>Escape means stand down, and it reaches every body at once.</p>
  <p>An agent looking at the canvas sees what is drawn on it: the blocks, the tables, the ink, rendered for it. Not your screen, and not <a href="/docs/tasks/">your list</a>.</p>
</section>

<section id="lanes">
  <h2>Several errands at once</h2>
  <p>Ask for three things and you get three columns, each with a cursor moving inside it, each labelled with the errand it is running.</p>
  <p>This is the one thing a plane does that a feed cannot. Two agents working at once in a chat window produce two message streams braided into one column, and the only way to read either is to filter by author in your head while both are still writing. That is why chat products serialise, and why two independent errands there take twice as long for no reason but the shape of the container.</p>
  <p>Nothing is drawn around the columns. You look once and you know how many things are going, which is which, how far each has got, and which one is stuck. Nothing an agent writes leaves its own column, and every lane says one line in the thread the moment it is done, including the ones that came back with nothing: a column gone quiet is otherwise indistinguishable from a column still working.</p>
  <p>Escape reaches lanes that have not started yet, as well as the ones running. Work nobody is waiting for should not set off behind your back.</p>
</section>

<section id="apps">
  <h2>Apps on the canvas</h2>
  <p>Press <span class="key">&#8997;</span><span class="key">B</span> and ask for something that runs. What comes back is a working app on the plane, not a picture of one and not a link elsewhere.</p>
  <p>Because it is on the canvas, everyone has the same app at the same coordinates, a rebuild reloads it under all of them at once, and pressing something in it is an event rather than a private one. An app can also hand an answer back, which is what makes a generated interface a control an agent reads: build a form, have people fill it in, and the agent that built it hears what they did.</p>
  <p>It runs sandboxed. It cannot touch the page around it, read your session, or reach the network.</p>
  <div class="note">
    <p>The canvas does not write these itself. Your coding agent does, on your machine against your repository, and hands the result over. So an app here can be a preview of your real code at a real commit rather than a mock-up that resembles it.</p>
  </div>
</section>
'''},

{
 'slug': 'your-agents',
 'nav': 'Your own agents',
 'group': 'Agents',
 'title': 'Your own agents',
 'lede': 'The coding agent you already pay for, the colleagues you write briefs '
         'for, and the procedures you hand both of them.',
 'body': '''
<section id="bring">
  <h2>Bring your own agent</h2>
  <p>Your coding agent can have a body here. It attaches over MCP and keeps its own machine, repository and test runner, while getting a cursor on the canvas with its own name and colour.</p>
  <p>Open Settings, then Models, then Agents, and pick the one you use. Cursor is a single click. The other two get a line to paste.</p>

  <h3>Claude Code</h3>
  <div class="snip">
    <div class="snip-tag">Terminal</div>
    <pre><code>claude mcp add --transport http soffo &lt;url&gt; --header "Authorization: Bearer &lt;key&gt;"</code></pre>
  </div>

  <h3>Codex</h3>
  <div class="snip">
    <div class="snip-tag">~/.codex/config.toml</div>
    <pre><code>[mcp_servers.soffo]
url = "&lt;url&gt;"</code></pre>
  </div>

  <h3>Anything else</h3>
  <p>One HTTP MCP server named <code>soffo</code>, under <code>mcpServers</code> in whatever <code>mcp.json</code> your client reads.</p>

  <div class="note">
    <p>The panel writes the real URL and key for you. The placeholders above are only the shape.</p>
    <p>A key opens one canvas, so replace any <code>soffo</code> entry already configured rather than adding a second: the old one points somewhere else. Most clients read that file only at startup, so expect the tools after a restart.</p>
  </div>

  <h3>What it can do once it is in</h3>
  <p>An attached agent gets the canvas as verbs rather than as a screen to parse. It can <b>look</b> at what is there, <b>note</b> something down, <b>edit</b> or <b>erase</b> a block, name an <b>area</b>, <b>move</b>, <b>say</b> a line in the thread, ask <b>who</b> is here, read the <b>tasks</b> it was handed, <b>build</b> a running app, and mark itself <b>finished</b>. Keys are revocable from the panel that minted them.</p>
</section>

<section id="colleagues">
  <h2>Building a colleague</h2>
  <p>Open the panel on the right (<span class="key">&#8997;</span><span class="key">K</span>) and add an agent. Three things make one:</p>
  <ul>
    <li><b>A name.</b> What you type after the <code>@</code>, and what its notes are signed with.</li>
    <li><b>A brief.</b> A paragraph saying what it is for. This goes in front of the model on every turn, so it is worth writing properly.</li>
    <li><b>Its tools.</b> The fixed set it may reach. An agent built for invoicing gets Stripe and the ledger, and cannot wander into Slack because a sentence mentioned it.</li>
  </ul>
  <p>It runs the same loop the resident does and arrives on the same plane. What it has that Soffo does not is the brief and the ceiling.</p>
  <p>Colleagues follow you rather than the canvas, so one you built this morning is on every canvas you open this afternoon. A body appears because you switched one on, and switching it off takes the cursor away.</p>
</section>

<section id="skills">
  <h2>Skills</h2>
  <p>A skill is a procedure you have handed over: a <code>SKILL.md</code> with frontmatter naming it and saying when it applies, and markdown underneath saying how it goes.</p>
  <p>The format is Claude Code&rsquo;s and Codex&rsquo;s, matched exactly, because a skill is a file you already have rather than something to author here, and because it has to go back out as one. An agent Soffo starts on a repository gets your skills written into its worktree at <code>.claude/skills/&lt;name&gt;/SKILL.md</code> and reads them natively, with none of this app in the way.</p>
  <p>Skills follow you, not the canvas. Attach the ones an agent should have on its row in the panel.</p>
</section>
'''},

{
 'slug': 'context',
 'nav': 'What agents read',
 'group': 'Agents',
 'title': 'What agents read',
 'lede': 'The accounts they can reach, and the documents you point them at.',
 'body': '''
<section id="apps">
  <h2>Connected apps</h2>
  <p>Connect an account once in the integrations panel and every agent in the workspace can reach it. After that, <code>@gmail what did Dan send about the contract</code> is the same gesture as asking a colleague.</p>
  <p>Gmail, Outlook, Slack, Notion, GitHub, Figma, Stripe, Supabase, Google Calendar, Docs and Sheets, Granola, Exa, Browserbase, Databricks, Ashby, among others.</p>
  <p>Only what you actually connected is offered in the <code>@</code> menu. An app on that list is a promise the tag will do something, and one you have not connected is a promise the canvas cannot keep, so it appears greyed with <em>connect</em> beside it and picking it opens the panel.</p>
</section>

<section id="contexts">
  <h2>Contexts</h2>
  <p>A context is a named body of text that lives somewhere else and is kept so it can be pointed at: a Notion page, a PDF, a meeting note, a section of a canvas. They sit on a shelf beside the canvas.</p>
  <p>The gesture is <code>#</code>, the same one sections answer to. Type it in a block, pick from the list, and whoever you are addressing gets that document.</p>
  <p>The text never enters your browser and never enters the prompt whole. A pill carries an identifier, and retrieval happens when the question is asked, so a forty-page contract stays where it is and what reaches the model is the passages that answer what you asked. The one time the full text arrives is when you open a context to read it yourself.</p>
</section>
'''},

{
 'slug': 'tasks',
 'nav': 'Tasks and routines',
 'group': 'Tasks',
 'title': 'Tasks and routines',
 'lede': 'The one private thing on a canvas where everything else is shared.',
 'body': '''
<section id="list">
  <h2>The list</h2>
  <p>Press <span class="key">&#8997;</span><span class="key">K</span>. The panel on the right has two tabs: what you have not done yet, and the colleagues you built to help you do it. They are together because they are one subject. You build an agent in order to hand it work, and you hand it work from a list.</p>
  <p><b>The list is private.</b> Everything on the plane is shared the moment it exists. This is not: it is not a canvas object, it does not travel over the socket, and it is not in what an agent is shown of the canvas. It is where you write <em>chase the invoice, I have been avoiding it</em>, and nobody writes that on a wall four colleagues are watching.</p>
  <p>It speaks the canvas&rsquo;s language anyway. <code>@</code> hands a task to somebody, <code>#</code> hands them a document to do it with, and the same <code>@</code> reaches an integration. When a task falls due the work happens in the open: a body walks onto the canvas and does it where you can watch.</p>
</section>

<section id="routines">
  <h2>Routines</h2>
  <p>A task is armed for a moment, like <em>in ten minutes</em>. A routine is armed for a shape: every hour, every day, every week on the days you pick, every month.</p>
  <p>The time zone travels with the routine rather than with your laptop. Set &ldquo;every morning at nine&rdquo; in Seoul and then fly to London, and it still means nine in the office you set it from. It says so wherever the time is shown.</p>
</section>
'''},

{
 'slug': 'sharing',
 'nav': 'Sharing a canvas',
 'group': 'Multiplayer',
 'title': 'Sharing a canvas',
 'lede': 'Who else is here, and what each of them may do.',
 'body': '''
<section id="roles">
  <h2>Roles</h2>
  <p>Invite people by email, or open the canvas to a link. Four roles, and the distinctions are about the document rather than about features:</p>
  <ul>
    <li><b>Owner.</b> Everything, including who else is here.</li>
    <li><b>Can edit.</b> Changes the canvas: moves things, draws, deletes, names a section, runs agents.</li>
    <li><b>Can comment.</b> Adds to the conversation: writes blocks, asks agents, reacts. No pen, because ink belongs to the canvas rather than to whoever laid it down and there is no erasing only your own.</li>
    <li><b>Can view.</b> Reads and moves around.</li>
  </ul>
</section>

<section id="together">
  <h2>Working together</h2>
  <p>Everyone gets a cursor and a colour, and you see each other&rsquo;s selections and edits as they happen.</p>
  <p>Whatever the role, <a href="/docs/tasks/">your list</a> stays yours.</p>
</section>
'''},

{
 'slug': 'account',
 'nav': 'Account',
 'group': 'Multiplayer',
 'title': 'Account',
 'lede': 'What your agents run on, and what it costs.',
 'body': '''
<section id="models">
  <h2>Models and keys</h2>
  <p>Settings, then Models, is where you say what your agents run on. Bring your own API key from Anthropic, OpenAI or Google, and the work runs on your account at your rates. The catalogue there is where you pick which model does what.</p>
  <p>A new account starts with nobody switched on: a canvas you can draw on with the agents off. That is deliberate, and it is what makes the choice at the end of your first run a real one.</p>
</section>

<section id="plans">
  <h2>Plans</h2>
  <p>Priced per person, per month.</p>
  <ul>
    <li><b>Small Team, $15.</b> Three workspaces, five agents, unlimited message history, bring your own API key.</li>
    <li><b>Growing Team, $25.</b> Unlimited workspaces, unlimited agents, unlimited message history, bring your own API key.</li>
  </ul>
  <p>A limit is reached rather than hit: the workspace or agent you are adding is refused, everything you already have goes on working, and the plan you are on says how many it includes.</p>
</section>
'''},
]

# --- what people type when they mean this ------------------------------------
#
# Search over the prose alone answers only the words we happened to use, which
# is the wrong test: somebody looking for the shortcut list types "shortcut",
# and that word is nowhere on the page that lists them. So each section carries
# the words a person would arrive with, including the ones this guide has
# deliberately avoided ("chat", "pricing", "todo") and the spellings it has not
# ("hotkey", "byok", "rag").
#
# Keyed "slug#section". They are searched, never shown.

KEYWORDS = {
    '#what':                 'overview introduction what is soffo about canvas plane multiplayer workspace chat',
    '#first':                'getting started begin quickstart install setup download mac app onboarding signup',
    'canvas#menu':           'command commands slash menu shortcut shortcuts hotkey keys keyboard mode modes toolbar palette',
    'canvas#writing':        'text block note message mention at sign hash markdown type edit author',
    'canvas#objects':        'table sheet page browser grid document spreadsheet rows web window paper',
    'canvas#drawing':        'draw drawing pen ink erase eraser annotate sketch circle arrow markup',
    'canvas#moving':         'zoom pan move navigate scroll fit selection shortcut shortcuts keys cursor cursors colour color presence',
    'agents#asking':         'ask asking mention prompt request run stop escape cancel reply answer chat',
    'agents#lanes':          'parallel concurrent multiple many at once errands lanes columns simultaneous queue',
    'agents#apps':           'build built app artifact generate interface tool sandbox preview iframe form internal',
    'your-agents#bring':     'mcp connect attach claude code codex cursor cli terminal config key token setup integrate own agent',
    'your-agents#colleagues':'custom agent create make build colleague brief role tools name persona teammate',
    'your-agents#skills':    'skill skills md procedure instruction playbook markdown frontmatter reuse',
    'context#apps':          'integration integrations connect connected app apps gmail slack notion github figma stripe supabase calendar account accounts oauth tools',
    'context#contexts':      'context contexts shelf document pdf notion memory knowledge retrieval rag reference source attach',
    'tasks#list':            'task tasks todo to-do list panel private personal reminder reminders sidebar assign',
    'tasks#routines':        'routine routines schedule scheduled recurring repeat cron daily weekly monthly hourly timezone automation',
    'sharing#roles':         'share sharing invite permission permissions access role roles editor viewer commenter owner guest collaborate team link',
    'sharing#together':      'presence cursor cursors collaboration collaborate multiplayer realtime live together people',
    'account#models':        'model models api key keys anthropic openai google claude gpt gemini settings byok provider catalogue billing',
    'account#plans':         'plan plans pricing price cost paid subscription billing seat seats limit limits upgrade free trial team',
}

# --- the shell ---------------------------------------------------------------

url_of = lambda slug: '/docs/' if not slug else '/docs/%s/' % slug


def sections_of(page):
    """The h2s on a page, as (anchor, text), for the sidebar and the index."""
    out = []
    for sid, inner in re.findall(r'<section id="([^"]+)">\s*<h2>(.*?)</h2>', page['body'], re.S):
        # Unescaped, because this text is written back into markup by the
        # sidebar and into JSON by the index. Left as entities it reaches the
        # search results as a literal "&ldquo;".
        out.append((sid, html.unescape(re.sub(r'<[^>]+>', '', inner)).strip()))
    return out


def sidebar(current):
    """The list on the left, with the current page's own sections opened under it."""
    rows, group = [], None
    for p in PAGES:
        if p['group'] != group:
            group = p['group']
            rows.append('      <h2>%s</h2>' % html.escape(group))
        here = p['slug'] == current['slug']
        rows.append('      <a class="dn-page%s" href="%s"%s>%s</a>'
                    % (' on' if here else '', url_of(p['slug']),
                       ' aria-current="page"' if here else '', html.escape(p['nav'])))
        # Only the page you are on. A sidebar that opens all eight is a table of
        # contents for the whole site, which is the thing splitting the page up
        # was meant to stop.
        if here:
            secs = sections_of(p)
            if len(secs) > 1:
                rows.append('      <div class="dn-subs">')
                for sid, text in secs:
                    rows.append('        <a class="dn-sub" href="#%s">%s</a>'
                                % (sid, html.escape(text)))
                rows.append('      </div>')
    return '\n'.join(rows)


def prevnext(i):
    bits = []
    if i > 0:
        p = PAGES[i - 1]
        bits.append('<a class="pn prev" href="%s"><span>Previous</span>%s</a>'
                    % (url_of(p['slug']), html.escape(p['nav'])))
    if i < len(PAGES) - 1:
        p = PAGES[i + 1]
        bits.append('<a class="pn next" href="%s"><span>Next</span>%s</a>'
                    % (url_of(p['slug']), html.escape(p['nav'])))
    if not bits:
        return ''
    return '\n      <nav class="docs-pn" aria-label="Pages">\n        %s\n      </nav>' % '\n        '.join(bits)


SHELL = '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title} - Soffo Docs</title>
  <meta name="description" content="{desc}" />
  <link rel="canonical" href="https://getsoffo.com{url}" />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/favicon.png" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/docs/docs.css" />
</head>
<body class="is-docs">
  <header class="topbar">
    <a class="wordmark" href="/" aria-label="Soffo home">Soffo</a>
    <div class="nav-right">
      <a class="nav-link" href="/docs/">Docs</a>
      <a class="nav-login" href="https://app.getsoffo.com">Log In</a>
    </div>
  </header>

  <main class="docs">
    <div class="docs-side">
      <div class="docs-find">
        <svg class="df-glass" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="m10.5 10.5 3 3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <input class="df-input" type="search" placeholder="Search" autocomplete="off" spellcheck="false"
               role="combobox" aria-expanded="false" aria-controls="df-list" aria-label="Search the docs" />
        <span class="df-hint" aria-hidden="true"><span class="key">&#8984;</span><span class="key">K</span></span>
        <div class="df-out" id="df-list" role="listbox" hidden></div>
      </div>

      <button class="docs-toggle" type="button" aria-expanded="false" aria-controls="docs-nav">
        Contents
        <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M7 1.5v11M1.5 7h11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      </button>

      <nav class="docs-nav" id="docs-nav" aria-label="Documentation">
{sidebar}
      </nav>
    </div>

    <article class="docs-body">
      <span class="eyebrow">{group}</span>
      <h1 class="docs-title">{title}</h1>
      <p class="docs-lede">{lede}</p>
{body}{prevnext}
    </article>
  </main>

  <footer class="site-foot">
    <div class="foot-brand">
      <a class="wordmark" href="/" aria-label="Soffo home">Soffo</a>
      <p class="foot-copy">&copy; 2026 MonyCompany Inc.</p>
    </div>

    <nav class="foot-nav" aria-label="Footer">
      <div class="foot-col">
        <h3>Company</h3>
        <a href="/">Home</a>
        <a href="/docs/">Docs</a>
      </div>
      <div class="foot-col">
        <h3>Social</h3>
        <a href="https://x.com/monycompany" target="_blank" rel="noopener">X / Twitter</a>
        <a href="https://www.linkedin.com/company/monyinc" target="_blank" rel="noopener">LinkedIn</a>
      </div>
      <div class="foot-col">
        <h3>Legal</h3>
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
      </div>
    </nav>
  </footer>

  <script src="/docs/docs.js"></script>
</body>
</html>
'''


def strip(markup):
    t = re.sub(r'<[^>]+>', ' ', markup)
    return re.sub(r'\s+', ' ', html.unescape(t)).strip()


def build():
    index = []

    for i, page in enumerate(PAGES):
        out = SHELL.format(
            title=html.escape(page['title']),
            desc=html.escape(strip(page['lede'])),
            url=url_of(page['slug']),
            group=html.escape(page['group']),
            lede=page['lede'],
            sidebar=sidebar(page),
            body=page['body'].strip(),
            prevnext=prevnext(i),
        )

        folder = OUT if not page['slug'] else os.path.join(OUT, page['slug'])
        os.makedirs(folder, exist_ok=True)
        with open(os.path.join(folder, 'index.html'), 'w') as f:
            f.write(out)

        # One search row per SECTION rather than per page, so a hit lands on the
        # paragraph somebody asked for instead of at the top of a page holding it
        # somewhere.
        body = page['body']
        for sid, heading in sections_of(page):
            chunk = body.split('<section id="%s">' % sid, 1)[1].split('</section>', 1)[0]
            index.append({
                'u': url_of(page['slug']) + '#' + sid,
                't': heading,
                'p': page['nav'],
                'k': KEYWORDS.get('%s#%s' % (page['slug'], sid), ''),
                'x': strip(chunk)[:600],
            })

    with open(os.path.join(OUT, 'search.json'), 'w') as f:
        json.dump(index, f, separators=(',', ':'))

    # A section with no keywords is findable only by the words we happened to
    # write, which is the failure this whole table exists to prevent. Say so
    # loudly rather than shipping a page nobody can search for.
    thin = [r['u'] for r in index if not r['k']]
    if thin:
        print('WARNING: no keywords for %s' % ', '.join(thin))

    print('%d pages, %d search rows' % (len(PAGES), len(index)))


if __name__ == '__main__':
    build()
