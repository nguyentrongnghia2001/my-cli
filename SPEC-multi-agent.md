# SPEC — chạy nhiều agent trong một workspace (v2)

> **Archived proposal.** This Node/Blessed multi-agent TUI plan is not an active product
> direction. Its worktree, multi-workspace, dynamic split, and persistence scope is
> outside the desktop MVP. See [`docs/PRODUCT_DIRECTION.md`](docs/PRODUCT_DIRECTION.md).

Trạng thái: draft, chờ chốt §10.
Phạm vi: mở rộng terminal panel của `wsedit ui` để chạy **nhiều agent CLI song song
trên cùng một repo**, nhìn thấy và lái được tất cả cùng lúc.

Nền tảng giữ nguyên: Node + blessed + node-pty. **Không** Electron, **không** Vue.
Spec v1 (`SPEC.md`) vẫn có hiệu lực; tài liệu này chỉ nói phần thêm và phần đổi.

Nguồn sự thật khi mâu thuẫn: `docs/agents/PHASE0.md` > `docs/agents/CONTRACTS.md` >
`SPEC.md` > tài liệu này.

---

## 1. Mục tiêu

Mở một repo, chạy 2–4 agent CLI (Claude Code, Codex, agy…) cùng lúc trên chính repo
đó, thấy output của tất cả trong một màn hình, và gõ được vào bất kỳ agent nào.

**Mục tiêu chất lượng**

- Thấy đồng thời ít nhất 2 pane mà không phải chuyển tab.
- Gõ vào một pane không ảnh hưởng pane khác; `Ctrl+C` chỉ giết agent trong pane đang focus.
- Thoát app không để sót tiến trình con — tiêu chí này đã có test, phải giữ xanh khi lên N pane.

**Phi mục tiêu (v2)**

- Không tự điều phối agent (không tự chia việc, không tự gộp kết quả). Người dùng vẫn là
  người điều phối; app chỉ là chỗ chạy và quan sát.
- Không chạy agent trên máy khác / qua SSH.
- Không parse output của agent để hiểu nó đang làm gì (xem §5 về giới hạn của chỉ báo trạng thái).
- Không tự resolve conflict khi hai agent sửa cùng file.

---

## 2. Hiện trạng và phần còn thiếu

Terminal panel đã làm xong (T4.1/T4.2) **đã có**: nhiều tab pty thật, mỗi tab một shell
hoặc một lệnh, scrollback 5.000 dòng, `Alt+←/→` đổi tab, thoát sạch không sót tiến trình.

Phần còn thiếu để đạt mục tiêu §1:

| # | Thiếu | Vì sao chặn |
|---|-------|-------------|
| 1 | Hiển thị đồng thời (split pane) | Hiện mỗi lúc chỉ thấy 1 tab — không quan sát song song được |
| 2 | Cô lập ghi file giữa các agent | Hai agent sửa cùng file sẽ đè nhau, mất việc |
| 3 | Kết thúc được một pane lẻ | `closeTab()` hiện để process treo (xem §6) |
| 4 | Chỉ báo pane nào đang chạy | Với 4 pane, không nhìn ra cái nào xong |
| 5 | Đủ phím điều hướng | Luật cứng PHASE0 chỉ cho giữ 2 phím (xem §4.4) |
| 6 | Nhiều project mở cùng lúc | Hiện chỉ mở được 1 thư mục gốc (SPEC.md §1 phi mục tiêu) |

Mục **2** và **3** là chặn thật, không phải tiện nghi. Mục 3 hiện là lỗi đã biết,
ghi trong `docs/agents/CHANGELOG.md`.

---

## 3. Vấn đề lõi: nhiều agent ghi cùng một repo

Đây là phần khó nhất và là lý do tính năng này không chỉ là "vẽ thêm pane".

Hai agent chạy song song trên cùng thư mục làm việc sẽ:

- đọc file lúc nó đang bị agent kia ghi dở,
- ghi đè thay đổi của nhau mà không ai báo lỗi,
- và nếu cả hai chạy `git` thì tranh nhau `index.lock`.

Đây không phải rủi ro lý thuyết: chính dự án này đã gặp — hai agent cùng sửa
`text-buffer.js` và `editor-view.js` trong một phiên, phải phát hiện bằng mắt.

**Ba chế độ cô lập, chọn theo pane:**

| Chế độ | Cách làm | Dùng khi | Rủi ro |
|--------|----------|----------|--------|
| `shared` | Mọi pane cùng `cwd` = gốc repo | Agent chỉ đọc (review, hỏi đáp, tìm hiểu code) | Cao nếu agent ghi |
| `worktree` | Mỗi pane một `git worktree` + branch riêng | Agent có sửa code — **mặc định khuyến nghị** | Tốn đĩa; phải merge sau |
| `scoped` | Cùng `cwd`, nhưng người dùng khai báo file mỗi agent được đụng | Việc nhỏ, chia rõ ràng | App **không ép được**, chỉ nhắc |

Quyết định thiết kế: **`worktree` là mặc định khi repo là git và agent được đánh dấu là
"có ghi"**. Lý do: đây là cách duy nhất trong ba cách mà máy bảo đảm được, hai cách kia
phụ thuộc vào việc agent tự giác.

Nói thẳng giới hạn: chế độ `scoped` **không phải cơ chế an toàn**, nó chỉ là ghi chú
hiển thị trên pane. App không chặn được agent ghi ra ngoài phạm vi.

Việc merge các worktree lại nằm **ngoài phạm vi v2** — người dùng tự `git merge`.

---

## 4. Bố cục và điều hướng

### 4.1 Mô hình: project → workspace → pane

Ba tầng, phân biệt rõ vì hay bị gộp nhầm:

- **Project** = một thư mục repo trên đĩa. Có đường dẫn, có thể là git hoặc không.
- **Workspace** = một project **đang mở**, kèm bố cục pane và danh sách agent của nó.
  Một project chỉ có một workspace tại một thời điểm.
- **Pane** = một pty đang chạy một agent hoặc shell, thuộc về đúng một workspace.

Mở nhiều workspace cùng lúc được, **và agent ở workspace không hiển thị vẫn chạy tiếp**.
Đây là điểm chính: bạn giao việc cho agent ở repo A, chuyển sang repo B làm việc khác,
quay lại thấy A đã xong.

Hệ quả phải chấp nhận: tiến trình chạy ngầm mà không nhìn thấy. Nên thanh workspace
**bắt buộc** phải hiện chỉ báo hoạt động, nếu không người dùng sẽ quên mình đang chạy gì
(§4.2), và khi thoát app phải cảnh báo còn bao nhiêu agent đang sống ở tất cả workspace.

### 4.2 Thanh workspace

Cột trái, rộng cố định 22 cột, bật/tắt được:

```
┌ WORKSPACE ────┐
│● stackgrid    │   ● vàng = có agent đang chạy
│  ~/rp/stackg… │   ○ xanh = mở, tất cả rảnh
│○ glow-ws    2 │   số bên phải = số pane
│  ~/nt/glow-ws │
│  glowarena    │   không chấm = đã mở, không có pane nào
│  ~/rp/glowar… │
│               │
│ + Mở project  │
└───────────────┘
```

- Tên project = tên thư mục. Đường dẫn cắt ở giữa (`~/rp/stackg…`), giữ phần đầu và
  phần đuôi vì phần đuôi mới phân biệt được các repo trùng tên.
- Chấm trạng thái gộp từ các pane của workspace đó, theo quy tắc ở §5: có **bất kỳ** pane
  nào `busy` thì workspace là `busy`.
- Workspace đang xem được tô nền.

Cột này ăn 22 cột chiều ngang, cộng với explorer của v1 nữa là mất khá nhiều chỗ trên
màn hình 80 cột. Vậy nên: **explorer và thanh workspace không hiện cùng lúc** — chung một
chỗ, đổi qua lại. Với terminal < 100 cột thì thanh workspace mặc định tắt.

### 4.3 Bố cục tổng thể

```
┌─ workspace ─┬─ tab bar ───────────────────────────┐
│ (hoặc       ├─ editor ────────────────────────────┤
│  explorer)  ├─ pane 1 (agent A) ─┬─ pane 2 (B) ───┤
│             ├────────────────────┴────────────────┤
│             │  pane 3 (shell)                     │
├─ status bar ────────────────────────────────────  ┤
└─ hint bar ──────────────────────────────────────  ┘
```

- Chia dọc / chia ngang pane đang focus.
- **Tối đa 4 pane.** Không phải giới hạn tuỳ tiện: mỗi pane là một tiến trình thật cộng
  một bộ đệm 5.000 dòng, và blessed vẽ lại toàn bộ vùng mỗi lần có output.
  Con số 4 là **giả định cần đo ở Phase A**, không phải kết quả đã đo.
- Mỗi pane cao tối thiểu 6 dòng, rộng tối thiểu 30 cột. Không đủ chỗ thì từ chối chia
  và báo qua status bar, không tự thu nhỏ pane khác xuống dưới ngưỡng.
- Zoom: phóng to pane đang focus chiếm toàn vùng terminal, nhấn lại để trả về.

Hình học vẫn phải là **số nguyên** — `blessed-xterm` ném lỗi với kích thước phần trăm
(PHASE0). Việc chia lưới phải phân bổ phần dư, không được làm tròn độc lập từng pane
rồi để hở một cột.

### 4.4 Ràng buộc phím — điểm thiết kế quan trọng nhất

Luật cứng PHASE0: khi focus ở terminal, **chỉ 2 phím** được giữ lại không gửi xuống pty
(hiện là `` Ctrl+` `` và `F6`). Mọi phím khác thuộc về agent. Nhiều pane cần nhiều lệnh
điều hướng hơn 2 phím rất nhiều.

Không được lấy thêm phím. Giải pháp: **phím dẫn (prefix), theo lối tmux.**

- Nhấn `` Ctrl+` `` → vào chế độ chờ lệnh (status bar đổi màu báo rõ).
- Phím kế tiếp là lệnh, không xuống pty:

| Sau `` Ctrl+` `` | Lệnh |
|---|---|
| `|` | chia dọc |
| `-` | chia ngang |
| `←↑↓→` | chuyển focus theo hướng |
| `1`..`4` | nhảy tới pane theo số |
| `z` | zoom pane |
| `x` | đóng pane (có hỏi nếu tiến trình còn sống) |
| `n` | pane mới, chọn agent |
| `w` | mở/đóng thanh workspace |
| `Tab` | chuyển workspace kế tiếp |
| `` ` `` | gửi một `` Ctrl+` `` thật xuống pty |
| bất kỳ phím khác | huỷ chế độ chờ, **không** gửi phím đó đi đâu |

Hai điều bắt buộc: chế độ chờ phải **thấy được** (không được im lặng), và phải huỷ được.
Một chế độ ẩn nuốt phím của người dùng là lỗi nặng hơn thiếu tính năng.

`F6` giữ nguyên nghĩa cũ: rời terminal về editor/explorer.

---

## 5. Trạng thái: cái gì biết được và cái gì không

### 5.1 Viền pane

Mỗi pane có một dòng tiêu đề 1 dòng, luôn hiện:

```
┌ 1 ● claude · stackgrid@agent-1 ──────────────┐
```

gồm: số pane · chấm trạng thái · tên agent · nhánh hoặc worktree đang chạy.
Pane đang focus tô viền sáng.

| Trạng thái | Suy ra từ | Màu |
|---|---|---|
| `busy` | Có output trong 2 giây gần nhất | vàng |
| `idle` | Không có output ≥ 2 giây, tiến trình còn sống | xanh |
| `exited` | Sự kiện `exit` của pty | xám, kèm mã thoát |

### 5.2 Giới hạn — đọc kỹ phần này trước khi kỳ vọng

**Chúng ta chỉ có một luồng byte.** Pty trả về text đã được agent vẽ sẵn; app không có
kênh nào để hỏi agent "mày đang làm gì".

Hệ quả 1 — trạng thái là **suy đoán từ hoạt động output**, không phải từ ý định.
Agent đang suy nghĩ mà không in gì sẽ bị đánh dấu `idle`. Agent đang in log rác là `busy`.

Hệ quả 2 — **những con số trong ảnh tham khảo không lấy ra được.** Dòng
`[Opus 4.8 (1M context)] 5%`, `Usage 30% (2h 34m / 4h)`, `Weekly 81%` trong ảnh là do
**Claude Code tự vẽ bên trong pane của nó**, không phải do app kia biết. Nó hiện lên
trong pane của chúng ta y hệt như vậy, vì ta vẽ nguyên luồng pty — nhưng ta **không thể
nhấc chúng ra** thanh trạng thái của mình mà không parse text của từng agent.

Việc parse đó là: mỗi agent một định dạng riêng, đổi bất cứ lúc nào agent cập nhật, và
hỏng âm thầm. Nên nó nằm ở §1 phi mục tiêu. Nếu sau này rất cần, làm theo hướng
**opt-in từng agent một** kèm test bám phiên bản, đừng làm heuristic chung.

Ngưỡng 2 giây là **giả định**, cần chỉnh sau khi dùng thật.

### 5.3 Thanh dưới cùng

Bên trái: đường dẫn workspace đang xem + nhánh git.
Bên phải: `4 pane · 2 đang chạy · chia dọc` — và tổng số agent đang sống ở **tất cả**
workspace nếu con số đó khác với workspace hiện tại (vì đó là thứ dễ quên nhất).

---

## 6. Vòng đời tiến trình

Đây là phần phải sửa lỗi đã biết trước khi làm tính năng.

**Hiện trạng:** `closeTab()` trong `src/ui/terminal-panel.js` gỡ listener nhưng **không
kết thúc pty** → shell sống tiếp mãi. Hiện chưa phím nào gọi tới nên chưa lộ. Có nhiều
pane thì đóng pane là thao tác thường ngày, nên lỗi này thành chặn.

**Không vá được bằng `pty.kill()`**: PHASE0 §7 đo được nó làm
`conpty_console_list_agent.js` crash `AttachConsole failed` và đổ stack ra terminal.

Hướng phải thử, theo thứ tự, và **phải đo chứ không suy luận**:

1. Gửi tín hiệu vào pty (`\x03` rồi `exit\r`) và chờ sự kiện `exit` — thoát êm, có timeout.
2. Nếu quá hạn: `process.kill(pty.pid)` bằng pid thật thay vì API của node-pty.
3. Nếu vẫn không được: Windows dùng `taskkill /T /F /PID`.

Tiêu chí nghiệm thu: đóng 1 pane trong khi 3 pane khác đang chạy → tiến trình của pane đó
biến mất, ba pane kia **không hề hấn**, và app không in stack trace nào.

Đường thoát cả app giữ nguyên PHASE0 §7: `screen.destroy()` → `process.exit(0)`.

---

## 7. Chọn agent

Tự dò các agent CLI đã cài bằng `executableExistsOnPath()` trong `src/core/shell.js`
(đã có sẵn, dùng lại được ngay).

- Danh sách dò: `claude`, `codex`, `gemini`, `agy` — cộng shell mặc định.
- Chỉ hiện cái nào thật sự tìm thấy trên `PATH`. **Không** liệt kê agent chưa cài rồi
  báo lỗi lúc chạy.
- Mỗi mục khai báo: lệnh, có ghi file hay không (quyết định chế độ cô lập ở §3), thư mục chạy.
- Cho phép nhập lệnh tuỳ ý — danh sách dò chỉ là lối tắt.

---

## 8. Hạn chế đã biết, mang sang từ PHASE0

- **Resize không tới được tiến trình con** (PHASE0 §4): kích thước tới được ConPTY nhưng
  child viết bằng Node/ink không được thông báo. Chia pane làm chuyện này nặng thêm — pane
  hẹp đi nhiều so với lúc agent khởi động. Không sửa được từ phía app; phải ghi rõ trong
  README rằng nên chia pane **trước** khi chạy agent.
- 4 mục PHASE0 §8 vẫn chưa nghiệm thu trên TTY thật.

---

## 9. Lộ trình

| Phase | Nội dung | Xong khi |
|---|---|---|
| A | Đo giới hạn: 2/3/4 pane cùng chạy lệnh in liên tục — đo độ trễ gõ và CPU | Có số thật cho giới hạn ở §4.1 |
| B | Sửa vòng đời tiến trình (§6) | Đóng 1 trong 4 pane sạch, không ảnh hưởng pane khác |
| C | Lưới pane + chia/đóng/zoom, hình học số nguyên | Chia dọc/ngang chạy, resize không vỡ |
| D | Phím dẫn (§4.2) | Vẫn chỉ giữ 2 phím; chế độ chờ thấy được và huỷ được |
| E | Cô lập `worktree` (§3) | 2 agent sửa cùng tên file, không đè nhau |
| F | Chỉ báo trạng thái + chọn agent (§5, §7) | Dò đúng agent đã cài |
| G | Nhiều workspace + thanh workspace (§4.1, §4.2) | Mở 2 project, agent ở cái ẩn vẫn chạy tiếp |
| H | Lưu/khôi phục bố cục theo project | Mở lại project thấy đúng bố cục lần trước (agent **không** tự chạy lại) |

Phase A đứng trước vì nếu 4 pane không dùng nổi thì phần còn lại của spec phải đổi.
Phase B đứng trước C vì thêm pane trước khi đóng được pane là tự nhân bản lỗi rò tiến trình.
Phase G đứng gần cuối vì nó nhân số tiến trình sống lên nhiều lần — chỉ làm sau khi vòng
đời tiến trình (B) đã chắc, nếu không mỗi lỗi rò sẽ nhân theo số workspace.

Phase H **chỉ khôi phục bố cục, không tự khởi động lại agent.** Tự chạy lại agent khi mở
project là hành vi bất ngờ và tốn tiền của người dùng — phải do người dùng bấm.

---

## 10. Câu hỏi mở — cần chốt trước khi code

1. **Số pane tối đa** — spec đang giả định 4, chờ số đo ở Phase A.
2. **Chế độ cô lập mặc định** — đề xuất `worktree` cho agent có ghi. Nó tốn đĩa và bắt
   người dùng phải merge sau; bạn có chấp nhận đánh đổi đó không?
3. **Phím dẫn `` Ctrl+` ``** — dùng lại chính phím đang bật/tắt terminal. Nếu giữ cả hai
   nghĩa thì phải phân biệt bằng ngữ cảnh (đang focus terminal hay không). Chấp nhận, hay
   đổi phím bật/tắt terminal sang chỗ khác?
4. **Đóng pane khi tiến trình còn sống** — hỏi xác nhận, hay đóng thẳng?
5. Ngưỡng `busy`/`idle` 2 giây (§5.1) — chỉnh sau khi dùng thật.
6. **Số workspace mở cùng lúc** — spec chưa đặt trần. 3 workspace × 4 pane = 12 tiến trình
   agent. Cần một trần, và cần đo ở Phase A xem trần đó là bao nhiêu.
7. **Trạng thái khi thoát app** — còn agent đang chạy ở workspace không nhìn thấy thì hỏi
   xác nhận kèm danh sách, hay giết thẳng? Đề xuất: hỏi, và liệt kê rõ workspace nào.
8. **Danh sách project nhớ ở đâu** — đề xuất `~/.wsedit/projects.json`. Cần chốt vì đây là
   file đầu tiên app ghi ra ngoài thư mục làm việc.

---

## 11. Nghiệm thu

- [ ] Chạy 2 agent thật song song trên cùng repo, cả hai đều gõ vào được.
- [ ] `Ctrl+C` ở pane 1 giết agent pane 1, pane 2 không hề hấn, app không thoát.
- [ ] Đóng pane 1 → tiến trình biến mất, pane 2–4 vẫn chạy.
- [ ] Hai agent chế độ `worktree` cùng sửa `README.md` → không mất thay đổi của nhau.
- [ ] Đổi kích thước cửa sổ khi 4 pane đang chạy → không vỡ layout, không crash.
- [ ] Thoát app → **không sót tiến trình con nào** (mở rộng test đã có sang N pane
      **và N workspace** — đây là chỗ dễ sót nhất).
- [ ] Chế độ chờ phím dẫn luôn thấy được và luôn huỷ được.
- [ ] Mở 2 project, chạy agent ở project A, chuyển sang B, quay lại → agent A vẫn chạy và
      output trong lúc vắng mặt **không bị mất**.
- [ ] Thanh workspace hiện đúng chấm `busy` cho project không đang xem.
- [ ] Thoát app khi còn agent chạy ở workspace ẩn → có cảnh báo liệt kê rõ, không giết lặng lẽ.
