const settings: Record<string, string> = {
  "Smooth scrolling": "Cuộn mượt",
  "Eases mouse-wheel scrolling instead of jumping line by line. Turn off if you prefer an instant response or notice any lag.":
    "Giúp thao tác cuộn bằng con lăn chuột mượt hơn thay vì nhảy từng dòng. Hãy tắt nếu bạn muốn phản hồi tức thì hoặc thấy bị giật.",
  "Sign in to Harbor": "Đăng nhập Harbor",
  "Create Harbor account": "Tạo tài khoản Harbor",
  "Claim your handle": "Đăng ký tên định danh",
  "Reset password (recovery key)": "Đặt lại mật khẩu (khóa khôi phục)",
  "Sign out of Harbor account": "Đăng xuất khỏi tài khoản Harbor",
  "Verified status": "Trạng thái xác minh",
  "Settings for this profile (shared or independent)":
    "Cài đặt cho hồ sơ này (dùng chung hoặc độc lập)",
  "PIN-locked profiles": "Hồ sơ khóa bằng PIN",
  "Home style (Harbor curated / Classic Stremio)":
    "Kiểu trang chủ (Harbor tuyển chọn / Stremio cổ điển)",
  "When the latest episode ends (Hide / Timer)": "Khi tập mới nhất kết thúc (Ẩn / Hẹn giờ)",
  "Remove shows once you're caught up": "Xóa phim bộ khi bạn đã xem hết tập mới nhất",
  "AI search provider (OpenRouter / Groq)": "Nhà cung cấp tìm kiếm AI (OpenRouter / Groq)",
  "Custom model id": "ID mô hình tùy chỉnh",
  "Use live web context (Jina Reader)": "Dùng ngữ cảnh web trực tiếp (Jina Reader)",
  "Jina API key": "Khóa API Jina",
  "Song ID provider (AudD / Gemini)": "Nhà cung cấp nhận diện bài hát (AudD / Gemini)",
  "Show an on-disk badge on cards": "Hiển thị huy hiệu có sẵn trên ổ đĩa trên thẻ",
  "Minimum file size (local scan)": "Kích thước tệp tối thiểu (quét cục bộ)",
  "Local playback preference (Ask / Play local / Stream)":
    "Tùy chọn phát cục bộ (Hỏi / Phát cục bộ / Phát trực tuyến)",
  "Export artwork sizes (Poster / Backdrop / Logo)":
    "Kích thước ảnh xuất (Áp phích / Ảnh nền / Logo)",
  "Sync indicator position": "Vị trí chỉ báo đồng bộ",
  "Scrobble to Simkl": "Ghi nhận lịch sử xem lên Simkl",
  "Display Simkl Community Ratings": "Hiển thị điểm đánh giá cộng đồng Simkl",
  "Home rail categories (Movies, TV, Anime)":
    "Danh mục hàng nội dung Trang chủ (Phim điện ảnh, Phim bộ, Anime)",
  "Relay version status": "Trạng thái phiên bản relay",
  "Download relay documentation": "Tải xuống tài liệu về relay",
  "Set active filter": "Đặt bộ lọc đang dùng",
  "Resolution filter": "Bộ lọc độ phân giải",
  "Source filter": "Bộ lọc nguồn",
  "Codec filter": "Bộ lọc codec",
  "Audio filter": "Bộ lọc âm thanh",
  "Snapdragon SGSR upscaler": "Bộ nâng cấp độ phân giải Snapdragon SGSR",
  "RAVU Lite prescaler": "Bộ tiền xử lý RAVU Lite",
  "NNEDI3 neural upscaler": "Bộ nâng cấp độ phân giải bằng mạng nơ-ron NNEDI3",
  "SSimSuperRes detail refinement": "Tinh chỉnh chi tiết SSimSuperRes",
  "KrigBilateral chroma upscaler": "Bộ nâng cấp sắc độ KrigBilateral",
  "Adaptive Sharpen": "Làm sắc nét thích ứng",
  "Short seek back": "Tua lùi ngắn",
  "Short seek forward": "Tua tới ngắn",
  "Live controller preview": "Xem trước bộ điều khiển trực tiếp",
  "Normalize embedded subtitle size": "Chuẩn hóa cỡ phụ đề nhúng",
  "SUBDL subtitle source": "Nguồn phụ đề SUBDL",
  "Subsource subtitle source": "Nguồn phụ đề Subsource",
  "Auto-apply audio-derived sync fixes": "Tự động áp dụng bản sửa lỗi đồng bộ dựa trên âm thanh",
  "Community sync server URL": "URL máy chủ đồng bộ cộng đồng",
  "Private mode (no community sync contact)": "Chế độ riêng tư (không kết nối đồng bộ cộng đồng)",
  "Poster image quality": "Chất lượng ảnh áp phích",
  "Home hero featured source": "Nguồn nội dung nổi bật đầu Trang chủ",
  "Export badge setup": "Thiết lập huy hiệu xuất",
  "Reset badges to default": "Đặt lại huy hiệu về mặc định",
  "Downloaded community badge packs": "Các gói huy hiệu cộng đồng đã tải xuống",
  "Test badge rules (Try it)": "Kiểm tra quy tắc huy hiệu (Dùng thử)",
  "Tracked person release rule": "Quy tắc phát hành cho người đang theo dõi",
  "Genre release rule": "Quy tắc phát hành theo thể loại",
  "Streamer release rule": "Quy tắc phát hành theo nền tảng phát trực tuyến",
  "Country release rule": "Quy tắc phát hành theo quốc gia",
  "Live TV reminder": "Lời nhắc TV trực tiếp",
  "Enable or disable rule": "Bật hoặc tắt quy tắc",
  "Rule notify channels": "Kênh thông báo của quy tắc",
  "Contact email or Discord": "Email liên hệ hoặc Discord",
  "Settings storage breakdown": "Chi tiết dung lượng lưu trữ Cài đặt",
  "Create folders for movies and shows": "Tạo thư mục cho phim điện ảnh và phim bộ",
  "Delete {name}": "Xóa {name}",
  "My filter": "Bộ lọc của tôi",
  Codec: "Codec",
  "HDR only": "Chỉ HDR",
  "Keep Dolby Vision, HDR10, HLG. Drop SDR.": "Giữ Dolby Vision, HDR10, HLG. Loại SDR.",
  "Only streams already in your debrid library.":
    "Chỉ các luồng đã có trong thư viện debrid của bạn.",
  "Min seeders": "Số seeder tối thiểu",
  "Excludes direct and debrid streams with no seeders.":
    "Loại trừ các luồng trực tiếp và debrid không có seeder.",
  "Max size (GB)": "Kích thước tối đa (GB)",
  "Caps file size. Unknown sizes still pass.":
    "Giới hạn kích thước tệp. Tệp không rõ kích thước vẫn được chấp nhận.",
  "No dimensions set. This filter matches every stream.":
    "Chưa đặt thuộc tính nào. Bộ lọc này khớp với mọi luồng phát.",
  "Trying source {n}": "Đang thử nguồn {n}",
  "Last source wasn't actually cached on your debrid yet. Trying another.":
    "Nguồn trước thực ra chưa được lưu vào bộ nhớ đệm trên dịch vụ debrid của bạn. Đang thử nguồn khác.",
  "A TOP 10 corner ribbon on the Top 10 rail posters. The watchlist marker auto-moves to the opposite corner so nothing overlaps.":
    "Dải băng TOP 10 ở góc áp phích trong hàng Top 10. Dấu danh sách xem tự động chuyển sang góc đối diện để không bị chồng lấp.",
  "A live preview of your player. Open the editor to move, hide, or reorder any control.":
    "Bản xem trước trực tiếp của trình phát. Mở trình chỉnh sửa để di chuyển, ẩn hoặc sắp xếp lại bất kỳ nút điều khiển nào.",
  "AI Search · Groq LPU inference": "Tìm kiếm bằng AI · Suy luận Groq LPU",
  "Above ratings": "Phía trên điểm đánh giá",
  "Add a TMDB key above to unlock.": "Thêm khóa TMDB ở trên để mở khóa.",
  "Add an MDBList key above to unlock.": "Thêm khóa MDBList ở trên để mở khóa.",
  "Add an OMDb key above to unlock.": "Thêm khóa OMDb ở trên để mở khóa.",
  "Add rule": "Thêm quy tắc",
  "Adds a timer button next to Downloads. Set a time or episode limit from anywhere; playback pauses when it runs out.":
    "Thêm nút hẹn giờ bên cạnh Tải xuống. Đặt giới hạn thời gian hoặc số tập ở bất kỳ đâu; nội dung đang phát sẽ tạm dừng khi hết giới hạn.",
  "After a moment on a slide, the featured title's trailer plays muted in the background. Uses more bandwidth.":
    "Sau một lúc ở một trang trình chiếu, trailer của nội dung nổi bật sẽ phát không tiếng trong nền. Tốn nhiều băng thông hơn.",
  "After the current show's episodes, Next flows into your queue. Off keeps Next/Previous within the current show only.":
    "Sau các tập của phim bộ hiện tại, nút Tiếp sẽ chuyển sang hàng chờ. Khi tắt, Tiếp/Trước chỉ chuyển trong phim bộ hiện tại.",
  "After you pick a source, show a subtitle picker so you can set the exact track and language before the video starts. Off by default, Harbor keeps picking one for you automatically.":
    "Sau khi bạn chọn nguồn, hiển thị trình chọn phụ đề để đặt chính xác phụ đề và ngôn ngữ trước khi video bắt đầu. Tính năng này mặc định tắt; Harbor sẽ tiếp tục tự động chọn cho bạn.",
  Aired: "Đã phát sóng",
  "All badges back to default": "Đã đặt lại tất cả huy hiệu về mặc định",
  "All custom rules removed": "Đã xóa tất cả quy tắc tùy chỉnh",
  "Any badges.json link works: a raw gist, Pastebin, or repo file. Broken JSON gets auto-repaired.":
    "Mọi liên kết badges.json đều dùng được: gist thô, Pastebin hoặc tệp trong kho mã. JSON lỗi sẽ được tự động sửa.",
  "App icon": "Biểu tượng ứng dụng",
  "App logo": "Logo ứng dụng",
  Applied: "Đã áp dụng",
  Apply: "Áp dụng",
  "Apply now": "Áp dụng ngay",
  "Art remap": "Ánh xạ lại hình ảnh",
  "As aired": "Theo thứ tự phát sóng",
  Audience: "Khán giả",
  "Augments AI picks with current web results before asking the model. Powered by":
    "Bổ sung kết quả web hiện tại vào các đề xuất của AI trước khi hỏi mô hình. Được hỗ trợ bởi",
  "Award Icons": "Biểu tượng giải thưởng",
  "Award tab on cards": "Tab giải thưởng trên thẻ",
  "Award tab position": "Vị trí tab giải thưởng",
  Backdrop: "Ảnh nền",
  "Badge art": "Hình huy hiệu",
  "Badge art back to default": "Đã đặt lại hình huy hiệu về mặc định",
  "Badge remaps": "Ánh xạ lại huy hiệu",
  "Badge updated": "Đã cập nhật huy hiệu",
  "Below ratings": "Phía dưới điểm đánh giá",
  "Top of card": "Đầu thẻ",
  Bottom: "Dưới cùng",
  "Build a named quality preference once and set it active. The picker prefers streams that match it, including the instant pick, and falls back to the next best source when nothing matches. Each filter ANDs its dimensions and ignores any you leave blank.":
    "Tạo một tùy chọn chất lượng có tên rồi đặt làm tùy chọn hiện hoạt. Trình chọn sẽ ưu tiên các luồng phát phù hợp, kể cả lựa chọn tức thì, và chuyển sang nguồn tốt nhất tiếp theo nếu không có nguồn nào phù hợp. Mỗi bộ lọc kết hợp các thuộc tính bằng AND và bỏ qua mọi thuộc tính để trống.",
  "Build a pack in any of these, export the JSON, host it as a gist, and paste the raw link below.":
    "Tạo một gói bằng bất kỳ công cụ nào trong số này, xuất JSON, lưu trữ dưới dạng gist rồi dán liên kết thô bên dưới.",
  "Card size": "Kích thước thẻ",
  Cards: "Thẻ",
  "Choose subtitles before playback": "Chọn phụ đề trước khi phát",
  Cinematic: "Điện ảnh",
  "Control bar": "Thanh điều khiển",
  "Copy filename": "Sao chép tên tệp",
  "Corners keep it clear of subtitles along the bottom.":
    "Đặt ở góc để không che phụ đề phía dưới.",
  "Could not apply": "Không thể áp dụng",
  "Couldn't reach that pack": "Không thể kết nối với gói đó",
  "Couldn't reach that pack (HTTP {n})": "Không thể kết nối với gói đó (HTTP {n})",
  "Custom art": "Hình ảnh tùy chỉnh",
  "Custom rules": "Quy tắc tùy chỉnh",
  "Customize each award": "Tùy chỉnh từng giải thưởng",
  "Default art": "Hình ảnh mặc định",
  "Delete rule": "Xóa quy tắc",
  "Disable all": "Tắt tất cả",
  "Disable rule": "Tắt quy tắc",
  "Disable torrents entirely": "Tắt hoàn toàn torrent",
  "Disabled because torrents are disabled above": "Đã tắt vì torrent bị tắt ở trên",
  "Edit layout": "Chỉnh sửa bố cục",
  "Enable TV navigation above to use focus navigation in the player.":
    "Bật điều hướng TV ở trên để dùng điều hướng tiêu điểm trong trình phát.",
  "Enable all": "Bật tất cả",
  "Enable rule": "Bật quy tắc",
  "Episode 2": "Tập 2",
  "Episode 3": "Tập 3",
  "Episode 4": "Tập 4",
  "Every format badge Harbor can show on streams. Click one to swap its art, hide it, or reset it. Changes apply everywhere badges appear.":
    "Tất cả huy hiệu định dạng mà Harbor có thể hiển thị trên các luồng phát. Nhấp vào một huy hiệu để đổi hình, ẩn hoặc đặt lại. Thay đổi áp dụng ở mọi nơi huy hiệu xuất hiện.",
  "Export artwork": "Xuất hình ảnh",
  "Export my setup": "Xuất thiết lập của tôi",
  "Extra large": "Cực lớn",
  "Fetches DuckDuckGo results and feeds top hits into the model prompt.":
    "Lấy kết quả từ DuckDuckGo và đưa các kết quả hàng đầu vào lời nhắc của mô hình.",
  "Fetching…": "Đang tải…",
  "Files smaller than this are skipped when scanning a folder, so clips and samples stay out. Set to 0 to include everything.":
    "Các tệp nhỏ hơn kích thước này sẽ bị bỏ qua khi quét thư mục, giúp loại trừ clip và tệp mẫu. Đặt thành 0 để bao gồm mọi tệp.",
  "Finds anime saved under a movie or series id (which breaks Continue Watching and Trakt) and removes just those so they re-add correctly.":
    "Tìm anime được lưu bằng id phim hoặc phim bộ (làm hỏng mục Xem tiếp và Trakt), rồi chỉ xóa các mục đó để chúng được thêm lại đúng cách.",
  "Flags anime with an English dub. Also tags dub / sub / dual on stream sources.":
    "Đánh dấu anime có lồng tiếng Anh. Đồng thời gắn nhãn lồng tiếng / phụ đề / song ngữ cho nguồn phát.",
  "Force player menus and panels to pure black, ignoring your theme tint.":
    "Buộc menu và bảng điều khiển của trình phát dùng màu đen thuần, bỏ qua sắc màu của giao diện.",
  "Found {n}: {names}. These are saved under the wrong id, which breaks Continue Watching and Trakt marking.":
    "Đã tìm thấy {n}: {names}. Các mục này được lưu bằng id không đúng, làm hỏng mục Xem tiếp và việc đánh dấu trên Trakt.",
  "Free tier": "Gói miễn phí",
  "Give each score a home: on poster cards, on the detail page, or both. Flip the switch in each column.":
    "Chọn nơi hiển thị cho từng điểm số: trên thẻ áp phích, trang chi tiết hoặc cả hai. Bật/tắt công tắc trong từng cột.",
  Glass: "Kính",
  "Groq API key (gsk-...)": "Khóa API Groq (gsk-...)",
  "Group Refresh on the left beside Back instead of the far right of the header.":
    "Đặt Làm mới ở bên trái cạnh Quay lại, thay vì ngoài cùng bên phải của tiêu đề.",
  "Harbor will not start the torrent engine, contact trackers, or run DHT. Use this if you only want debrid and direct links. Turn off to re-enable torrent streaming.":
    "Harbor sẽ không khởi động công cụ torrent, liên hệ tracker hoặc chạy DHT. Dùng tùy chọn này nếu bạn chỉ muốn liên kết debrid và trực tiếp. Tắt tùy chọn để bật lại phát trực tuyến qua torrent.",
  "Hide badge": "Ẩn huy hiệu",
  "Hide manga": "Ẩn manga",
  "Hide pack instructions": "Ẩn hướng dẫn về gói",
  "Home hero audio": "Âm thanh tiêu điểm trang chủ",
  "How big episode cards are in the strip and grid layouts. Bigger cards show larger artwork.":
    "Kích thước thẻ tập trong bố cục dải và lưới. Thẻ lớn hơn sẽ hiển thị hình ảnh lớn hơn.",
  "How sharp trailers play. Auto follows your connection speed, and the Watch Trailer button targets 1080p. Pick 1080p or Best (up to 4K when the source has it) to force higher. 1080p and Best merge separate video and audio with the bundled ffmpeg, so they take a beat longer to start.":
    "Độ nét khi phát trailer. Tự động điều chỉnh theo tốc độ kết nối, còn nút Xem trailer nhắm đến 1080p. Chọn 1080p hoặc Tốt nhất (tối đa 4K nếu nguồn có) để buộc dùng chất lượng cao hơn. 1080p và Tốt nhất ghép video và âm thanh riêng bằng ffmpeg đi kèm, nên sẽ mất thêm chút thời gian để bắt đầu.",
  "How the on-screen controls read while you watch.":
    "Cách hiển thị nội dung trên các nút điều khiển khi xem.",
  "How to make an award pack": "Cách tạo gói giải thưởng",
  "Image URL (optional)": "URL hình ảnh (không bắt buộc)",
  "Image too large. Keep badge files under 250 KB.":
    "Hình ảnh quá lớn. Giữ tệp huy hiệu dưới 250 KB.",
  Import: "Nhập",
  "Import a .zip pack": "Nhập gói .zip",
  "Import a file instead": "Nhập tệp thay thế",
  "Import any pack": "Nhập gói bất kỳ",
  "Install a pack": "Cài đặt gói",
  "Installing...": "Đang cài đặt...",
  "Jina API key (optional)": "Khóa API Jina (không bắt buộc)",
  "Keep downloading after you leave": "Tiếp tục tải xuống sau khi rời đi",
  "Live web (Jina Reader)": "Web trực tiếp (Jina Reader)",
  Logo: "Logo",
  "Logo & app icon": "Logo và biểu tượng ứng dụng",
  MB: "MB",
  "Make Harbor yours: swap the sidebar logo and the window/taskbar icon.":
    "Cá nhân hóa Harbor: đổi logo thanh bên và biểu tượng cửa sổ/thanh tác vụ.",
  "Make your own": "Tự tạo",
  "Max scores per card": "Số điểm tối đa trên mỗi thẻ",
  "Minimum file size": "Kích thước tệp tối thiểu",
  Modern: "Hiện đại",
  "Move Refresh next to Back": "Chuyển Làm mới đến cạnh Quay lại",
  "Move focus with the keyboard, like a TV remote.":
    "Di chuyển tiêu điểm bằng bàn phím như dùng điều khiển TV.",
  NEW: "MỚI",
  "Name (e.g. REMUX)": "Tên (ví dụ: REMUX)",
  "Native to Harbor. No RPDB or ratings addon needed.":
    "Tích hợp sẵn trong Harbor. Không cần RPDB hoặc tiện ích bổ sung xếp hạng.",
  "No badges match this title.": "Không có huy hiệu nào phù hợp với tựa phim này.",
  "No custom rules yet. Add one below, or install a pack to bring some in.":
    "Chưa có quy tắc tùy chỉnh. Hãy thêm một quy tắc bên dưới hoặc cài đặt một gói để bổ sung quy tắc.",
  "No issues found. Your anime library looks clean.":
    "Không phát hiện vấn đề. Thư viện anime của bạn không có lỗi.",
  "No rules match your search.": "Không có quy tắc nào khớp với tìm kiếm.",
  "Nothing usable in that file": "Không có nội dung nào dùng được trong tệp đó",
  "One-click community packs. Rulesets bring full badge sets with their own matching; art remaps only swap the pictures on Harbor's built-in badges. Anything shared as a badges.json link on the Nuvio Discord or Reddit imports here too.":
    "Gói cộng đồng cài bằng một cú nhấp. Bộ quy tắc cung cấp đầy đủ các huy hiệu cùng cơ chế đối sánh riêng; bản ánh xạ lại hình ảnh chỉ thay hình trên các huy hiệu tích hợp của Harbor. Mọi liên kết badges.json được chia sẻ trên Discord Nuvio hoặc Reddit cũng có thể nhập tại đây.",
  "Optional overlays that appear over the video.": "Các lớp phủ tùy chọn xuất hiện trên video.",
  "Or just zip up images": "Hoặc chỉ cần nén ảnh thành tệp zip",
  "Or try one of ours": "Hoặc thử một gói của chúng tôi",
  "Packs & import": "Gói & nhập",
  "Paste an image URL (png, webp, svg)": "Dán URL hình ảnh (png, webp, svg)",
  "Pick a source once and Harbor keeps playing the rest of that season from the same release, no re-picking. Works best with a debrid season pack. For anime it locks the whole series to that release.":
    "Chỉ cần chọn nguồn một lần, Harbor sẽ tiếp tục phát các tập còn lại của mùa đó từ cùng một bản phát hành mà không cần chọn lại. Hoạt động tốt nhất với gói debrid theo mùa. Với anime, toàn bộ phim bộ sẽ được khóa vào bản phát hành đó.",
  "Play a short sound when changing the player volume. Off by default.":
    "Phát âm thanh ngắn khi thay đổi âm lượng trình phát. Mặc định tắt.",
  "Play trailers in the hero": "Phát trailer trong khu vực nổi bật",
  "Player style": "Kiểu trình phát",
  "Player volume sounds": "Âm thanh khi chỉnh âm lượng trình phát",
  Poster: "Áp phích",
  "Queue drives Next/Previous": "Hàng đợi điều khiển Tiếp theo/Trước đó",
  "Re-apply to the window and taskbar now": "Áp dụng lại cho cửa sổ và thanh tác vụ ngay",
  "Refresh button": "Nút Làm mới",
  Reinstall: "Cài đặt lại",
  Remap: "Ánh xạ lại",
  "Remove remap": "Xóa ánh xạ lại",
  "Removes the Anime tab and every anime title from all rows everywhere: Home, Discover, Top 10, and catalogs. Western animation like Pixar is kept, and you can still find anime by searching.":
    "Xóa thẻ Anime và mọi tựa anime khỏi tất cả các hàng ở mọi nơi: Trang chủ, Khám phá, Top 10 và danh mục. Hoạt hình phương Tây như Pixar vẫn được giữ lại và bạn vẫn có thể tìm anime bằng tính năng tìm kiếm.",
  "Removes the Manga tab from the sidebar.": "Xóa thẻ Manga khỏi thanh bên.",
  "Repair anime library": "Sửa chữa thư viện anime",
  Replace: "Thay thế",
  "Reset all": "Đặt lại tất cả",
  "Reset all art": "Đặt lại toàn bộ hình ảnh",
  "Reset everything": "Đặt lại mọi thứ",
  "Restore previous settings": "Khôi phục cài đặt trước đó",
  Retro: "Hoài cổ",
  "Ribbon corner": "Góc dải băng",
  "Rich season and order panel": "Bảng mùa và thứ tự chi tiết",
  "Rotten Tomatoes": "Rotten Tomatoes",
  Ruleset: "Bộ quy tắc",
  "Score badges on cards": "Huy hiệu điểm trên thẻ phim",
  "Score position": "Vị trí điểm",
  "Search rules by name or pattern…": "Tìm quy tắc theo tên hoặc mẫu…",
  "Serves this exact install of Harbor as a web app on your network. Open it on a phone, laptop, or TV browser, sign in there, and it streams through this computer. You can also use the phone remote to control playback and cast to another device on this machine.":
    "Cung cấp chính bản cài đặt Harbor này dưới dạng ứng dụng web trên mạng của bạn. Mở ứng dụng trong trình duyệt trên điện thoại, máy tính xách tay hoặc TV, đăng nhập tại đó và nội dung sẽ được truyền phát qua máy tính này. Bạn cũng có thể dùng điều khiển trên điện thoại để điều khiển phát và truyền đến một thiết bị khác trên máy này.",
  "Set active": "Đặt làm đang hoạt động",
  "Settings for this profile": "Cài đặt cho hồ sơ này",
  "Setup copied to clipboard as JSON": "Đã sao chép thiết lập vào bảng nhớ tạm dưới dạng JSON",
  "Show DUB badge on anime cards": "Hiển thị huy hiệu DUB trên thẻ anime",
  "Show a bookmark on saved titles": "Hiển thị dấu trang trên các tựa phim đã lưu",
  "Show a laurel award tab on winning titles, like Netflix. Replaces the corner award chip and sits centered so it clears the rating and watchlist pills. Pick where it sits below.":
    "Hiển thị thẻ giải thưởng vòng nguyệt quế trên các tựa phim đoạt giải, giống Netflix. Thẻ này thay thế nhãn giải thưởng ở góc và nằm chính giữa để không che các nhãn xếp hạng và danh sách xem. Chọn vị trí bên dưới.",
  "Show badge": "Hiển thị huy hiệu",
  "Show controls when pausing with keyboard": "Hiển thị nút điều khiển khi tạm dừng bằng bàn phím",
  "Show sync indicator": "Hiển thị chỉ báo đồng bộ",
  "Show tags on cards": "Hiển thị thẻ trên các thẻ nội dung",
  "Show the player controls when you pause or resume using the keyboard. Turn off to keep them hidden so they don't cover subtitles.":
    "Hiển thị các nút điều khiển trình phát khi bạn tạm dừng hoặc tiếp tục bằng bàn phím. Tắt để luôn ẩn chúng, tránh che phụ đề.",
  "Sleep timer in the top bar": "Hẹn giờ ngủ trên thanh trên cùng",
  "Sound effects": "Hiệu ứng âm thanh",
  "Sound effects volume": "Âm lượng hiệu ứng âm thanh",
  "Square mark in the sidebar. Transparent PNG or SVG works best.":
    "Biểu tượng vuông trong thanh bên. PNG hoặc SVG trong suốt cho kết quả tốt nhất.",
  Structured: "Có cấu trúc",
  "Subtle audio feedback as you navigate and click. Off by default; pick a style to turn it on.":
    "Phản hồi âm thanh nhẹ khi bạn điều hướng và nhấp. Mặc định tắt; chọn một kiểu để bật.",
  "Sync indicator": "Chỉ báo đồng bộ",
  "TV navigation": "Điều hướng TV",
  "TV navigation in player": "Điều hướng TV trong trình phát",
  "Tap again to delete {n} rules": "Nhấn lại để xóa {n} quy tắc",
  "Tap again to reset everything": "Nhấn lại để đặt lại mọi thứ",
  "Tap again to reset {n}": "Nhấn lại để đặt lại {n}",
  "Tap again to reset {n} badges": "Nhấn lại để đặt lại {n} huy hiệu",
  "Tap to switch": "Nhấn để chuyển",
  "That doesn't look like an image URL": "Đây có vẻ không phải URL hình ảnh",
  "That file isn't valid JSON": "Tệp đó không phải JSON hợp lệ",
  "That pack's file isn't valid JSON": "Tệp của gói đó không phải JSON hợp lệ",
  "The New, In Cinema, Rerun, and Awards chips. Turn off for a cleaner grid. Score chips are separate, below.":
    "Các nhãn Mới, Đang chiếu rạp, Chiếu lại và Giải thưởng. Tắt để lưới gọn hơn. Nhãn điểm được thiết lập riêng ở bên dưới.",
  "The TMDB community score.": "Điểm cộng đồng TMDB.",
  "The badge that appears over the player when an episode syncs to your tracker.":
    "Huy hiệu xuất hiện trên trình phát khi một tập được đồng bộ với dịch vụ theo dõi của bạn.",
  "The button set your layout is built on. Your customizations are kept separately for each style.":
    "Bộ nút làm nền tảng cho bố cục của bạn. Các tùy chỉnh được lưu riêng cho từng kiểu.",
  "The free tier is $0 for personal use. Just pick the first option, no payment needed.":
    "Gói miễn phí có giá $0 cho mục đích sử dụng cá nhân. Chỉ cần chọn tùy chọn đầu tiên, không cần thanh toán.",
  "The home hero trailer plays with sound and a mute button in the corner, then shows a replay button when it ends. Auto-rotation pauses so it stays on the featured title.":
    "Trailer nổi bật trên trang chủ phát kèm âm thanh và có nút tắt tiếng ở góc, sau đó hiển thị nút phát lại khi kết thúc. Tính năng tự động chuyển sẽ tạm dừng để giữ nguyên nội dung nổi bật.",
  "The little 4K, HDR, codec, and audio chips that ride along each stream in the play picker.":
    "Các nhãn nhỏ 4K, HDR, codec và âm thanh hiển thị cùng mỗi luồng trong trình chọn phát.",
  "The little score chip printed on poster cards across your rows and grids.":
    "Nhãn điểm nhỏ hiển thị trên các thẻ áp phích trong các hàng và lưới.",
  "The ratings row on a title's detail page, next to runtime and genre.":
    "Hàng điểm đánh giá trên trang chi tiết nội dung, bên cạnh thời lượng và thể loại.",
  "The resolution Harbor downloads for each image when you export a title's metadata next to the file on disk.":
    "Độ phân giải hình ảnh mà Harbor tải xuống khi bạn xuất siêu dữ liệu của nội dung cạnh tệp trên ổ đĩa.",
  "The window and taskbar icon updates right away. The installed shortcut refreshes on the next update.":
    "Biểu tượng cửa sổ và thanh tác vụ được cập nhật ngay. Lối tắt đã cài đặt sẽ được làm mới trong lần cập nhật tiếp theo.",
  "These badges are drawn on posters as you browse. RPDB, in the keys above, is a separate option that bakes scores into the poster image itself.":
    "Các huy hiệu này được hiển thị trên áp phích khi bạn duyệt. RPDB trong các khóa ở trên là một tùy chọn riêng, nhúng điểm trực tiếp vào hình ảnh áp phích.",
  "This score only appears on cards.": "Điểm này chỉ xuất hiện trên các thẻ nội dung.",
  "Top 10 ribbon": "Dải băng Top 10",
  "Torrents are disabled. Uncached streams will not play unless they come from a debrid service or a direct link. To use torrents, toggle this off.":
    "Torrent đang bị tắt. Các luồng chưa lưu vào bộ nhớ đệm sẽ không phát được, trừ khi đến từ dịch vụ debrid hoặc liên kết trực tiếp. Để dùng torrent, hãy tắt tùy chọn này.",
  "True black menus": "Menu đen tuyệt đối",
  "Try it": "Dùng thử",
  "Turn off to hide the sync badge during playback.": "Tắt để ẩn huy hiệu đồng bộ trong khi phát.",
  "Type what you want in plain language and let a model find it. Bring your own API key.":
    "Nhập nội dung bạn muốn bằng ngôn ngữ tự nhiên và để mô hình tìm kiếm. Dùng khóa API của riêng bạn.",
  "Updating separated settings per profile, which may have reset your theme and keys. Harbor still has your old setup saved. Bring it back on this profile, then reload.":
    "Đang cập nhật để tách riêng Cài đặt theo từng hồ sơ, việc này có thể đã đặt lại giao diện và các khóa của bạn. Harbor vẫn lưu thiết lập cũ. Hãy khôi phục thiết lập đó cho hồ sơ này rồi tải lại.",
  Upload: "Tải lên",
  "Upload image": "Tải hình ảnh lên",
  "Upload multiple images": "Tải nhiều hình ảnh lên",
  "Use arrows and Select/Space to move focus between player controls. Turn this off to keep arrows for seeking and Space for play/pause.":
    "Dùng các phím mũi tên và Select/Space để chuyển tiêu điểm giữa các nút điều khiển trình phát. Tắt tùy chọn này để dùng phím mũi tên để tua và Space để phát/tạm dừng.",
  "Use in Nuvio": "Dùng trong Nuvio",
  "Use live web context": "Dùng ngữ cảnh web trực tiếp",
  "Use the arrow keys and Enter to move focus through Harbor. Turn this off to keep arrow keys free and disable focus navigation everywhere.":
    "Dùng các phím mũi tên và Enter để di chuyển tiêu điểm trong Harbor. Tắt tùy chọn này để không dùng phím mũi tên cho điều hướng và vô hiệu hóa điều hướng bằng tiêu điểm ở mọi nơi.",
  "Use your own image as the app icon": "Dùng hình ảnh của bạn làm biểu tượng ứng dụng",
  "Watchlist bookmark": "Dấu trang danh sách xem",
  "When off, a torrent stops the moment you close or switch the stream, so nothing keeps downloading in the background. Turn on to let it keep going after you leave; manage or pause those from the Downloads tab.":
    "Khi tắt, torrent sẽ dừng ngay khi bạn đóng hoặc chuyển luồng, nên không có nội dung nào tiếp tục tải xuống trong nền. Bật để torrent tiếp tục sau khi bạn rời đi; quản lý hoặc tạm dừng chúng trong thẻ Tải xuống.",
  "Where scores appear": "Vị trí hiển thị điểm",
  "Where the Refresh button sits in the picker header. Default keeps it on the right, across from Back.":
    "Vị trí của nút Làm mới trong tiêu đề trình chọn. Mặc định đặt nút ở bên phải, đối diện nút Quay lại.",
  "Which order": "Thứ tự nào",
  "While you watch": "Trong khi xem",
  "Wide logo shown beside the mark when the sidebar is expanded.":
    "Logo ngang hiển thị cạnh biểu tượng khi thanh bên được mở rộng.",
  Wordmark: "Logo chữ",
  "Your own badges, matched against the stream's name with a pattern. Great for release groups, providers, or anything the built-in badges don't cover. Imported packs land here too.":
    "Huy hiệu riêng của bạn, được đối chiếu với tên luồng bằng mẫu. Phù hợp cho nhóm phát hành, nhà cung cấp hoặc bất kỳ nội dung nào huy hiệu tích hợp chưa hỗ trợ. Các gói đã nhập cũng xuất hiện tại đây.",
  "by {name}": "bởi {name}",
  "copied!": "đã sao chép!",
  "for higher rate limits; leave blank for the free anonymous tier.":
    "để có giới hạn tốc độ cao hơn; để trống để dùng gói ẩn danh miễn phí.",
  "jina_...": "jina_...",
  skipped: "đã bỏ qua",
  "{a} badges remapped, {b} rules added": "Đã ánh xạ lại {a} huy hiệu, thêm {b} quy tắc",
  "{n} Harbor icons": "{n} biểu tượng Harbor",
  "{n} badges customized": "Đã tùy chỉnh {n} huy hiệu",
  "{n} enabled": "Đã bật {n}",
  "{n} rules · {m} on": "{n} quy tắc · {m} đang bật",
  "{themeName} theme": "Giao diện {themeName}",
  "Home hero": "Banner nổi bật Trang chủ",
  "Make the featured banner on Home bigger and sharper.":
    "Làm banner nổi bật trên Trang chủ lớn và sắc nét hơn.",
  "Full hero banner": "Banner nổi bật toàn chiều rộng",
  "Stretch the featured hero edge to edge and taller, across every layout.":
    "Kéo giãn banner nổi bật sát hai cạnh và tăng chiều cao trong mọi bố cục.",
  "Full quality hero image": "Ảnh nổi bật chất lượng đầy đủ",
  "Load the highest-resolution artwork for the featured hero. Uses more bandwidth.":
    "Tải hình ảnh có độ phân giải cao nhất cho banner nổi bật. Tốn nhiều băng thông hơn.",
  "Display language": "Ngôn ngữ hiển thị",
  "Interface language": "Ngôn ngữ giao diện",
  "Metadata language": "Ngôn ngữ siêu dữ liệu",
  Region: "Khu vực",
  "Region & language": "Khu vực & ngôn ngữ",
  "English (default)": "Tiếng Anh (mặc định)",
  "Apply {language}": "Áp dụng {language}",
  "Switch Harbor to {language}?": "Chuyển Harbor sang {language}?",
  "Just change region": "Chỉ đổi khu vực",
  "Translate titles": "Dịch tiêu đề",
  "If disabled, titles remain in their original language.":
    "Nếu tắt, tiêu đề sẽ giữ nguyên ngôn ngữ gốc.",
  "Translate descriptions": "Dịch mô tả",
  "If disabled, overviews and taglines remain in their original language. (Applies only inside the details page)":
    "Nếu tắt, phần tổng quan và câu giới thiệu sẽ giữ nguyên ngôn ngữ gốc. (Chỉ áp dụng trong trang chi tiết)",
  "Translate posters": "Dịch áp phích",
  "If disabled, posters remain in their original language. (Applies only inside the details page)":
    "Nếu tắt, áp phích sẽ giữ nguyên ngôn ngữ gốc. (Chỉ áp dụng trong trang chi tiết)",
  "Poster translation is disabled because a custom poster service is active.":
    "Tính năng dịch áp phích bị tắt vì đang sử dụng dịch vụ áp phích tùy chỉnh.",
  "Metadata providers": "Nhà cung cấp siêu dữ liệu",
  "Content filters": "Bộ lọc nội dung",
  "Sets the language of Harbor's own interface: menus, buttons, and labels. Arabic switches the layout to right to left. This is separate from subtitle and metadata languages below.":
    "Đặt ngôn ngữ cho giao diện của Harbor: menu, nút và nhãn. Tiếng Ả Rập chuyển bố cục sang từ phải sang trái. Cài đặt này tách biệt với ngôn ngữ phụ đề và siêu dữ liệu bên dưới.",
  "Switch the menus and buttons to your language. Arabic flips the layout to right to left.":
    "Chuyển menu và nút sang ngôn ngữ của bạn. Tiếng Ả Rập đảo bố cục sang từ phải sang trái.",
  "This sets the interface, metadata, subtitle, and audio languages to match.":
    "Cài đặt này đồng bộ ngôn ngữ giao diện, siêu dữ liệu, phụ đề và âm thanh.",
  "Titles, overviews, and taglines from TMDB display in this language when a translation exists. Needs a TMDB key.":
    "Tiêu đề, phần tổng quan và câu giới thiệu từ TMDB sẽ hiển thị bằng ngôn ngữ này khi có bản dịch. Cần khóa TMDB.",
  "Used for streaming availability and the Now Playing release window. Pick a country and Harbor can match the interface, metadata, and subtitle languages to it.":
    "Dùng cho tình trạng có thể phát trực tuyến và khung thời gian phát hành Đang chiếu. Chọn một quốc gia để Harbor đồng bộ ngôn ngữ giao diện, siêu dữ liệu và phụ đề tương ứng.",
  "A free TMDB key is highly recommended. It unlocks the full Harbor experience. The rest are optional, and Cinemeta works out of the box without any.":
    "Rất nên dùng khóa TMDB miễn phí. Khóa này mở khóa đầy đủ trải nghiệm Harbor. Các khóa còn lại là tùy chọn, còn Cinemeta hoạt động ngay mà không cần khóa nào.",
  "TMDB asks for an app URL when you create the key. Put any URL at all, like https://harbor.app. The only thing you need back is the API key.":
    "TMDB yêu cầu URL ứng dụng khi bạn tạo khóa. Nhập URL bất kỳ, chẳng hạn https://harbor.app. Thứ duy nhất bạn cần nhận lại là khóa API.",
  "RPDB already paints scores onto the poster. Toggle to override.":
    "RPDB đã hiển thị điểm số trên áp phích. Bật để ghi đè.",
  "MyAnimeList scores for anime titles. RPDB doesn't cover anime, so this stays optional.":
    "Điểm MyAnimeList cho các tựa anime. RPDB không hỗ trợ anime nên mục này vẫn là tùy chọn.",
  "v3 API key": "Khóa API v3",
  "8-character key": "Khóa 8 ký tự",
  "personal key": "Khóa cá nhân",
  "subscriber API key": "Khóa API dành cho người đăng ký",
  "mdblist api key": "Khóa API mdblist",
  "rpdb key": "Khóa rpdb",
  "https://posters.example.com or a pattern with {id}":
    "https://posters.example.com hoặc mẫu có {id}",
  "The yellow chip in the poster corner.": "Nhãn màu vàng ở góc áp phích.",
  "Hide adult content": "Ẩn nội dung người lớn",
  "Filters out streams from adult catalogs and addons. On by default.":
    "Lọc các luồng từ danh mục và tiện ích bổ sung dành cho người lớn. Mặc định bật.",
  "Hide anime": "Ẩn anime",
  "Removes the Anime tab and any Trending/Popular/Upcoming/New anime rows from Home.":
    "Xóa thẻ Anime cùng mọi hàng Anime thịnh hành/Phổ biến/Sắp ra mắt/Mới trên Trang chủ.",
  "Hide Live TV": "Ẩn TV trực tiếp",
  "Removes the Live TV tab from the sidebar.": "Xóa thẻ TV trực tiếp khỏi thanh bên.",
  "Hide entire categories. Toggling these also removes the matching sidebar entries and rails.":
    "Ẩn toàn bộ danh mục. Việc bật/tắt các mục này cũng xóa những mục và hàng tương ứng trên thanh bên.",
  "Show Playlists tab": "Hiện thẻ Danh sách phát",
  "Adds a Playlists item to the navigation for browsing movies and shows from your M3U or Xtream playlists (the same ones you add for Live TV). Off by default to keep the nav tidy.":
    "Thêm mục Danh sách phát vào phần điều hướng để duyệt phim và phim bộ từ danh sách phát M3U hoặc Xtream (cũng là những danh sách bạn thêm cho TV trực tiếp). Mặc định tắt để phần điều hướng gọn gàng.",
  "Show IMDb score on cards": "Hiện điểm IMDb trên thẻ",
  "Blur spoilers": "Làm mờ nội dung tiết lộ",
  "Blur thumbnails": "Làm mờ ảnh thu nhỏ",
  "Blur titles": "Làm mờ tiêu đề",
  "Blur descriptions": "Làm mờ mô tả",
  Spoilers: "Nội dung tiết lộ",
  "Hides spoiler-prone episode details in episode lists until you have watched them.":
    "Ẩn các chi tiết dễ tiết lộ nội dung trong danh sách tập cho đến khi bạn xem xong.",
  "Blur episode artwork, titles, and descriptions for episodes you have not watched yet, on both shows and anime. Hover an episode to peek.":
    "Làm mờ hình ảnh, tiêu đề và mô tả của các tập chưa xem trong cả phim bộ và anime. Di chuột lên tập để xem nhanh.",
  "Leave the episode you are up to clear and only blur the ones after it.":
    "Giữ rõ tập bạn đang xem đến và chỉ làm mờ các tập sau đó.",
  "Keep the next episode visible": "Giữ tập tiếp theo hiển thị",
  "Blur episode images on detail page": "Làm mờ ảnh tập trên trang chi tiết",
  "Blurs the hero image and stills on the episode detail page until you click reveal.":
    "Làm mờ ảnh chính và ảnh tĩnh trên trang chi tiết tập cho đến khi bạn nhấp để hiện.",
  "Hides anime from the Home Continue Watching row. It still appears in the Anime tab's own Continue Watching.":
    "Ẩn anime khỏi hàng Xem tiếp trên Trang chủ. Nội dung này vẫn xuất hiện trong hàng Xem tiếp riêng của thẻ Anime.",
  "Keep anime in the Anime room only": "Chỉ giữ anime trong khu vực Anime",
  "Harbor still finds and loads subtitles so they're one click away in the player, it just won't turn them on automatically.":
    "Harbor vẫn tìm và tải phụ đề để bạn có thể bật bằng một lần nhấp trong trình phát, nhưng sẽ không tự động bật.",
  "When the file ships its own subtitle track, keep it selected instead of switching to a downloaded one. Embedded tracks are usually the best synced.":
    "Khi tệp có sẵn rãnh phụ đề, giữ rãnh đó được chọn thay vì chuyển sang phụ đề đã tải xuống. Các rãnh nhúng thường đồng bộ tốt nhất.",
  "When the audio already matches your subtitle language, pick a forced track (foreign dialogue and signs only) instead of full subtitles. If the file has no forced track, subtitles stay off.":
    "Khi âm thanh đã khớp với ngôn ngữ phụ đề, chọn rãnh bắt buộc (chỉ lời thoại tiếng nước ngoài và biển báo) thay vì phụ đề đầy đủ. Nếu tệp không có rãnh bắt buộc, phụ đề sẽ vẫn tắt.",
  "Preferred languages": "Ngôn ngữ ưu tiên",
  "Only show streams in my languages": "Chỉ hiện luồng bằng ngôn ngữ của tôi",
  "Hides streams with no detected preferred language. Multi-audio releases count as a match.":
    "Ẩn các luồng không phát hiện được ngôn ngữ ưu tiên. Bản phát hành đa âm thanh vẫn được tính là khớp.",
  "Streams in these languages rank first. Toggle below to drop everything else.":
    "Các luồng bằng những ngôn ngữ này được xếp trước. Bật tùy chọn bên dưới để loại bỏ mọi ngôn ngữ khác.",
  "When playback starts, Harbor automatically finds and loads a subtitle in one of these languages, so you never have to search by hand. The first available match wins, so put your main language first.":
    "Khi bắt đầu phát, Harbor tự động tìm và tải phụ đề bằng một trong các ngôn ngữ này để bạn không phải tìm thủ công. Kết quả khớp đầu tiên sẽ được chọn, vì vậy hãy đặt ngôn ngữ chính lên đầu.",
  "Never auto-select tracks containing": "Không bao giờ tự động chọn rãnh có chứa",
  "commentary, descriptive": "bình luận, mô tả",
  "Comma-separated words. Audio or subtitle tracks whose name matches any of these are skipped during automatic selection. You can still pick them by hand in the player.":
    "Các từ phân tách bằng dấu phẩy. Rãnh âm thanh hoặc phụ đề có tên khớp với bất kỳ từ nào trong số này sẽ bị bỏ qua khi chọn tự động. Bạn vẫn có thể chọn thủ công trong trình phát.",
  "When a release ships multiple audio tracks, Harbor selects the first match from this list.":
    "Khi một bản phát hành có nhiều rãnh âm thanh, Harbor sẽ chọn kết quả khớp đầu tiên trong danh sách này.",
  "By default, addon rails that duplicate the built-in ones (Trending, Popular, Top Rated, etc.) are merged so you don't see the same row twice. Turn this on to show every one, duplicates and all.":
    "Theo mặc định, các hàng của tiện ích bổ sung trùng với hàng tích hợp (Thịnh hành, Phổ biến, Đánh giá cao nhất, v.v.) sẽ được hợp nhất để bạn không thấy cùng một hàng hai lần. Bật tùy chọn này để hiện tất cả, kể cả các mục trùng lặp.",
  "When you back out of a title, Harbor saves a frame so the Continue Watching card looks like the spot you left. Tune how long they stick around, or wipe them all.":
    "Khi bạn thoát khỏi một nội dung, Harbor lưu một khung hình để thẻ Xem tiếp hiển thị đúng vị trí bạn đã dừng. Hãy điều chỉnh thời gian lưu hoặc xóa tất cả.",
  "When you finish an episode, the Home Continue Watching card moves on to the next episode instead of sitting at 0 minutes left.":
    "Khi bạn xem xong một tập, thẻ Xem tiếp trên Trang chủ sẽ chuyển sang tập tiếp theo thay vì dừng ở mốc còn 0 phút.",
  "Keep the Library Watchlist tab limited to titles you added in Stremio. Turn this off to also include anything Stremio auto-added when you pressed play.":
    "Giới hạn thẻ Danh sách xem trong Thư viện ở những nội dung bạn đã thêm vào Stremio. Tắt tùy chọn này để bao gồm cả nội dung Stremio tự động thêm khi bạn nhấn phát.",
  "Heads up: Harbor was built in English. Multi-language support is partial, so your addons usually catch what Harbor's own filters miss. If you speak another language and want to help fill the gaps, the source is open.":
    "Lưu ý: Harbor được xây dựng bằng tiếng Anh. Hỗ trợ đa ngôn ngữ vẫn còn hạn chế, vì vậy các tiện ích bổ sung thường tìm được những nội dung mà bộ lọc của Harbor bỏ sót. Nếu bạn sử dụng ngôn ngữ khác và muốn góp phần hoàn thiện, mã nguồn được công khai.",
  "Contribute on GitHub": "Đóng góp trên GitHub",
  "Stremio account": "Tài khoản Stremio",
  Custom: "Tùy chỉnh",
  "Search settings": "Tìm kiếm cài đặt",
  Account: "Tài khoản",
  "Your Stremio sign-in. Library, watch progress, and addons sync from here.":
    "Thông tin đăng nhập Stremio của bạn. Thư viện, tiến độ xem và tiện ích bổ sung được đồng bộ từ đây.",
  "Library & metadata": "Thư viện & siêu dữ liệu",
  "Optional keys that unlock TMDB rails, baked-in poster ratings, fanart, and TVDB episode data.":
    "Các khóa tùy chọn giúp mở khóa hàng TMDB, điểm đánh giá tích hợp trên áp phích, fanart và dữ liệu tập TVDB.",
  "Connect your Trakt account to scrobble playback, sync your watchlist, and pull personalized recommendations.":
    "Kết nối tài khoản Trakt để ghi nhận nội dung đang phát, đồng bộ danh sách xem và nhận đề xuất dành riêng cho bạn.",
  AniList: "AniList",
  "Connect your AniList account to show your anime lists as rails on the Anime page.":
    "Kết nối tài khoản AniList để hiển thị các danh sách anime của bạn dưới dạng hàng trên trang Anime.",
  Simkl: "Simkl",
  "Connect your Simkl account to mark what you finish as watched and sync your plan-to-watch list across apps.":
    "Kết nối tài khoản Simkl để đánh dấu nội dung đã xem xong và đồng bộ danh sách dự định xem giữa các ứng dụng.",
  "Harbor Relay": "Harbor Relay",
  "A Cloudflare Worker on your own account that hosts your Watch Together rooms.":
    "Một Cloudflare Worker trên tài khoản của bạn để lưu trữ các phòng Xem cùng nhau.",
  "Streaming sources": "Nguồn phát trực tuyến",
  "How Harbor finds and resolves playable streams. Debrid keys and addon installs live here.":
    "Cách Harbor tìm và phân giải các luồng có thể phát. Khóa debrid và tiện ích bổ sung đã cài đặt nằm ở đây.",
  "Which audio and subtitle languages rank first in stream lists.":
    "Ngôn ngữ âm thanh và phụ đề nào được ưu tiên trong danh sách luồng.",
  Hotkeys: "Phím tắt",
  "Every shortcut Harbor responds to. Click a binding to rebind it.":
    "Tất cả phím tắt mà Harbor hỗ trợ. Nhấp vào một tổ hợp phím để gán lại.",
  "Theme & appearance": "Chủ đề & giao diện",
  "Color presets, custom backgrounds, and the font pair Harbor renders in.":
    "Bảng màu có sẵn, hình nền tùy chỉnh và cặp phông chữ Harbor sử dụng.",
  Webhooks: "Webhook",
  "Push upcoming releases to Discord or Telegram. Pick which calendars feed the notifications.":
    "Gửi thông báo về các nội dung sắp phát hành đến Discord hoặc Telegram. Chọn lịch dùng để tạo thông báo.",
  "Report a bug": "Báo lỗi",
  "Send a bug report straight to the Harbor team. Screenshots and screen recordings welcome.":
    "Gửi báo cáo lỗi trực tiếp đến đội ngũ Harbor. Khuyến khích đính kèm ảnh chụp hoặc bản ghi màn hình.",
  "Show Rotten Tomatoes score on cards": "Hiện điểm Rotten Tomatoes trên thẻ",
  "Fresh tomatoes for 60% and up, splat for anything under.":
    "Cà chua tươi cho điểm từ 60% trở lên, cà chua vỡ cho điểm thấp hơn.",
  "Show MAL score on cards": "Hiện điểm MAL trên thẻ",
  "MyAnimeList scores for anime titles. RPDB doesn't cover anime, so this stays an opt-in.":
    "Điểm MyAnimeList cho các tựa anime. RPDB không hỗ trợ anime nên tùy chọn này không được bật sẵn.",
  "Hover a poster to peek at its rating, runtime, and synopsis without opening it.":
    "Di chuột lên áp phích để xem nhanh điểm số, thời lượng và tóm tắt mà không cần mở.",
  "Badge position": "Vị trí huy hiệu",
  "TMDB · catalogs and rails": "TMDB · danh mục và hàng nội dung",
  "OMDb · Rotten Tomatoes scores": "OMDb · điểm Rotten Tomatoes",
  "RPDB · scores baked into posters": "RPDB · điểm được tích hợp vào áp phích",
  "MDBList · Letterboxd and Trakt scores": "MDBList · điểm Letterboxd và Trakt",
  "Custom poster service": "Dịch vụ áp phích tùy chỉnh",
  "Cleaner grid for when your poster service already prints the title onto the artwork.":
    "Lưới gọn hơn khi dịch vụ áp phích đã in tiêu đề lên hình ảnh.",
  "Fanart.tv · logos and backdrops": "Fanart.tv · logo và ảnh nền",
  "TheTVDB · episode data": "TheTVDB · dữ liệu tập",
  Advanced: "Nâng cao",
  "1 frame stored. Wiping rebuilds them next time you watch.":
    "Đã lưu 1 khung hình. Xóa sẽ tạo lại vào lần xem tiếp theo.",
  "{count} frames stored. Wiping rebuilds them next time you watch.":
    "Đã lưu {count} khung hình. Xóa sẽ tạo lại vào lần xem tiếp theo.",
  "Diagnostics, manual overrides, things most users never need.":
    "Chẩn đoán, ghi đè thủ công và những tùy chọn hầu hết người dùng không bao giờ cần.",
  "Watch Together rooms are routed through Harbor's hosted relay.":
    "Các phòng Xem cùng nhau được định tuyến qua relay do Harbor lưu trữ.",
  Streaming: "Phát trực tuyến",
  Playback: "Phát",
  Appearance: "Giao diện",
  Notifications: "Thông báo",
  Help: "Trợ giúp",
  "When you back out of a title, Harbor saves a frame so the Continue Watching card looks like the spot you left.":
    "Khi bạn thoát khỏi một tựa phim, Harbor lưu lại một khung hình để thẻ Xem tiếp hiển thị đúng đoạn bạn đã dừng.",
  "Used for streaming availability and the Now Playing release window.":
    "Dùng để xác định khả năng xem trực tuyến và khoảng thời gian phát hành của mục Đang chiếu.",
  "MyAnimeList scores for anime titles.": "Điểm MyAnimeList cho các tựa anime.",
  "Hero carousel, Top 10, Trending, In Theaters, per-service rails.":
    "Băng chuyền nổi bật, Top 10, Thịnh hành, Đang chiếu tại rạp, các hàng theo từng dịch vụ.",
  Updates: "Cập nhật",
  "Harbor checks harbor.site for new versions and installs them in place.":
    "Harbor kiểm tra phiên bản mới trên harbor.site và cài đặt trực tiếp.",
  "Backup & restore": "Sao lưu và khôi phục",
  "Export your entire Harbor setup to a single file, then restore it on a new computer or keep it as a backup.":
    "Xuất toàn bộ thiết lập Harbor thành một tệp duy nhất, sau đó khôi phục trên máy tính mới hoặc lưu làm bản sao lưu.",
  Privacy: "Quyền riêng tư",
  "System tray": "Khay hệ thống",
  "Stremio install links": "Liên kết cài đặt Stremio",
  "Harbor catches stremio:// install links so the configure-and-install flow stays inside the app.":
    "Harbor tiếp nhận các liên kết cài đặt stremio:// để toàn bộ quy trình cấu hình và cài đặt diễn ra trong ứng dụng.",
  "Discord Rich Presence": "Discord Rich Presence",
  "Let your Discord friends see what you are watching, with the show poster and a live progress bar.":
    "Cho bạn bè trên Discord biết bạn đang xem gì, kèm áp phích phim và thanh tiến trình trực tiếp.",
  "API budget": "Hạn mức API",
  "Daily call counter for OMDb rating lookups. Reset if it stops returning fresh scores.":
    "Bộ đếm lượt gọi hằng ngày để tra cứu điểm trên OMDb. Đặt lại nếu không còn trả về điểm mới.",
  Onboarding: "Hướng dẫn ban đầu",
  "Replay the walkthrough or unhide every dismissed tip in the app.":
    "Xem lại hướng dẫn hoặc hiện lại mọi mẹo đã ẩn trong ứng dụng.",
  "Stremio library repair": "Sửa thư viện Stremio",
  "Scans your Stremio library and rewrites any item whose shape doesn't match Stremio's exact schema.":
    "Quét thư viện Stremio và ghi lại mọi mục có cấu trúc không khớp chính xác với lược đồ của Stremio.",
  About: "Giới thiệu",
  "Build identity. Useful when filing a bug report at bugs@harbor.site.":
    "Thông tin bản dựng. Hữu ích khi báo lỗi tại bugs@harbor.site.",
  "Reveal the show or movie artwork.": "Hiện hình ảnh của phim bộ hoặc phim điện ảnh.",
  Legal: "Pháp lý",
  "Made with": "Được tạo nên bằng",
  "by Harbor contributors": "bởi những người đóng góp cho Harbor",
  "Know more": "Tìm hiểu thêm",
  "A special thank you to the team at Stremio-Addons. Please consider supporting them.":
    "Đặc biệt cảm ơn đội ngũ Stremio-Addons. Hãy cân nhắc ủng hộ họ.",
  "Debrid services": "Dịch vụ debrid",
  "TorBox API key": "Khóa API TorBox",
  "AllDebrid API key": "Khóa API AllDebrid",
  "Premiumize API key": "Khóa API Premiumize",
  "Debrid-Link API key": "Khóa API Debrid-Link",
  "Streaming catalogs": "Danh mục phát trực tuyến",
  "Top titles per service. Toggle off the ones you don't pay for.":
    "Các tựa phim hàng đầu theo từng dịch vụ. Tắt những dịch vụ bạn không đăng ký.",
  "Stream safety filter": "Bộ lọc an toàn luồng phát",
  "Result order": "Thứ tự kết quả",
  "Condensed shows a top pick, quality tiles, and a drawer. Stremio is a flat list grouped by addon, no scoring.":
    "Thu gọn hiển thị lựa chọn hàng đầu, các ô chất lượng và một ngăn kéo. Stremio hiển thị danh sách phẳng, nhóm theo tiện ích bổ sung và không chấm điểm.",
  "Stream format chips": "Nhãn định dạng luồng phát",
  "The little 4K · HDR · codec · audio chips that ride along each stream in the play picker.":
    "Các nhãn nhỏ 4K · HDR · codec · âm thanh đi kèm mỗi luồng trong trình chọn phát.",
  "Synced addons": "Tiện ích bổ sung đã đồng bộ",
  "How aggressively Harbor rejects shady or mismatched streams before showing them in the picker.":
    "Mức độ Harbor loại bỏ các luồng đáng ngờ hoặc không khớp trước khi hiển thị trong trình chọn.",
  Strict: "Nghiêm ngặt",
  "Default. Rejects size outliers, suspicious extensions, year/episode mismatches, season packs (for episode requests), trailers, and likely cams.":
    "Mặc định. Loại bỏ tệp có kích thước bất thường, phần mở rộng đáng ngờ, sai năm/tập, gói cả mùa (khi yêu cầu một tập), trailer và bản quay rạp khả nghi.",
  Balanced: "Cân bằng",
  "Keeps the malware/year/episode-mismatch checks but allows season packs and oversized files. Same as hitting Search wider in the picker.":
    "Vẫn kiểm tra mã độc và sai năm/tập, nhưng cho phép gói cả mùa và tệp quá lớn. Tương tự như nhấn Tìm rộng hơn trong trình chọn.",
  "No filtering. Every stream every addon returns shows up, including obvious junk. You'll be on your own.":
    "Không lọc. Mọi luồng do mọi tiện ích bổ sung trả về đều xuất hiện, kể cả nội dung rác rõ ràng. Bạn phải tự cân nhắc.",
  Condensed: "Thu gọn",
  "Default. Top pick at the top, quality tiles, and an All-Sources drawer. Harbor scores and ranks results.":
    "Mặc định. Lựa chọn hàng đầu ở trên cùng, các ô chất lượng và ngăn Tất cả nguồn. Harbor chấm điểm và xếp hạng kết quả.",
  "Flat list of sources grouped by addon, with a filter dropdown. No re-ranking. Closest match to the Stremio app's stream picker.":
    "Danh sách nguồn dạng phẳng, nhóm theo tiện ích bổ sung, kèm menu bộ lọc thả xuống. Không xếp hạng lại. Gần giống nhất với trình chọn luồng của ứng dụng Stremio.",
  "Harbor ranking": "Xếp hạng của Harbor",
  "Default. Harbor parses and scores every source and surfaces the best quality first.":
    "Mặc định. Harbor phân tích và chấm điểm mọi nguồn, rồi đưa chất lượng tốt nhất lên đầu.",
  "Addon order": "Thứ tự tiện ích bổ sung",
  "Show each addon's results in the order it returned them, grouped by your addon list. Matches the Stremio and Vidi apps.":
    "Hiển thị kết quả của từng tiện ích bổ sung theo đúng thứ tự trả về, nhóm theo danh sách tiện ích bổ sung của bạn. Giống các ứng dụng Stremio và Vidi.",
  "Real-Debrid, TorBox, AllDebrid, Premiumize, Debrid-Link. Cached streams play direct. Keys stay local.":
    "Real-Debrid, TorBox, AllDebrid, Premiumize, Debrid-Link. Luồng đã lưu đệm được phát trực tiếp. Các khóa chỉ được lưu cục bộ.",
  "Real-Debrid API token": "Token API Real-Debrid",
  "API token": "Token API",
  "API key": "Khóa API",
  "Faster and quieter than torrents if you already pay for Usenet. Configure on the addon page, paste the manifest URL it returns.":
    "Nhanh hơn và ít ồn hơn torrent nếu bạn đã trả phí cho Usenet. Hãy cấu hình trên trang tiện ích bổ sung rồi dán URL manifest được trả về.",
  "Searches and streams directly off Easynews. No debrid needed. Just your Easynews login.":
    "Tìm kiếm và phát trực tiếp từ Easynews. Không cần dịch vụ debrid. Chỉ cần thông tin đăng nhập Easynews.",
  Expired: "Đã hết hạn",
  "Harbor pulls your addon collection from Stremio. Manage individual addons in Streaming sources.":
    "Harbor lấy bộ sưu tập tiện ích bổ sung của bạn từ Stremio. Quản lý từng tiện ích bổ sung trong Nguồn phát trực tuyến.",
  "A specific summary lands faster than a long paragraph. Steps to reproduce help most of all.":
    "Bản tóm tắt cụ thể dễ được chú ý hơn một đoạn văn dài. Các bước tái hiện lỗi là hữu ích nhất.",
  Summary: "Tóm tắt",
  "Steps to reproduce": "Các bước tái hiện lỗi",
  "What broke?": "Lỗi gì?",
  "What actually happened": "Điều thực sự đã xảy ra",
  "What you expected": "Điều bạn mong đợi",
  Severity: "Mức độ nghiêm trọng",
  "Screenshots and recordings": "Ảnh chụp màn hình và bản ghi",
  "Credit (optional)": "Ghi công (không bắt buộc)",
  "Bug reporters get listed in the release notes when their report leads to a shipped fix. Leave blank to stay anonymous.":
    "Người báo lỗi sẽ được ghi tên trong ghi chú phát hành nếu báo cáo của họ giúp đưa ra bản sửa lỗi chính thức. Để trống nếu muốn ẩn danh.",
  Theme: "Giao diện",
  "Theme Library": "Thư viện giao diện",
  "Your themes": "Giao diện của bạn",
  "Ships with Harbor. Always available.": "Đi kèm Harbor. Luôn có sẵn.",
  "Themes you imported or built.": "Giao diện bạn đã nhập hoặc tạo.",
  "Build a new theme": "Tạo giao diện mới",
  "Copy theme": "Sao chép giao diện",
  Copy: "Sao chép",
  "Apply custom theme": "Áp dụng giao diện tùy chỉnh",
  "Background image": "Ảnh nền",
  Ambience: "Không khí",
  "The quick brown fox jumps over the lazy dog":
    "Con cáo nâu nhanh nhẹn nhảy qua chú chó lười biếng",
  "Default. Humanist serif, warm sans.": "Mặc định. Serif nhân văn, sans ấm áp.",
  "Classic. Was Harbor's original pair.": "Cổ điển. Cặp phông chữ ban đầu của Harbor.",
  "Clean modern. Sans across the board.": "Hiện đại, gọn gàng. Dùng sans toàn bộ.",
  "Editorial. Headline-strong display.": "Phong cách biên tập. Kiểu hiển thị nổi bật cho tiêu đề.",
  "Technical. IBM's open family.": "Kỹ thuật. Họ phông chữ mở của IBM.",
  "Stremio's typeface. Geometric humanist sans.": "Phông chữ của Stremio. Sans hình học nhân văn.",
  "Whatever your OS uses.": "Dùng phông chữ của hệ điều hành.",
  Typography: "Kiểu chữ",
  Colors: "Màu sắc",
  "Color tokens": "Token màu",
  "Theme cheat sheet": "Bảng tham khảo nhanh về giao diện",
  "Stable selectors": "Bộ chọn ổn định",
  "Now using": "Đang dùng",
  "Custom palette": "Bảng màu tùy chỉnh",
  "Hand-tuned colors. Edit them in the section above.":
    "Màu được tinh chỉnh thủ công. Chỉnh sửa trong phần bên trên.",
  "Edit colors": "Chỉnh sửa màu",
  Bokeh: "Bokeh",
  "Top dock": "Thanh dock trên cùng",
  "Side rail": "Thanh bên",
  "Stremio rail": "Thanh bên Stremio",
  "Floating dock": "Thanh dock nổi",
  "Dracula sidebar": "Thanh bên Dracula",
  "Nord sidebar": "Thanh bên Nord",
  "Forest sidebar": "Thanh bên Forest",
  "Royal top bar": "Thanh trên cùng Royal",
  "Cinematic overlay": "Lớp phủ điện ảnh",
  "tvOS chrome": "Giao diện tvOS",
  tvOS: "tvOS",
  "Living-room focus, floating glass chrome.": "Tối ưu cho phòng khách, giao diện kính nổi.",
  "Custom chrome": "Giao diện tùy chỉnh",
  "Sidebar layout": "Bố cục thanh bên",
  "Glass cards": "Thẻ kính",
  "Stremio cards": "Thẻ Stremio",
  "Hairline cards": "Thẻ viền mảnh",
  "Crunch cards": "Thẻ Crunch",
  "Noir cards": "Thẻ Noir",
  "Custom cards": "Thẻ tùy chỉnh",
  "Flat cards": "Thẻ phẳng",
  "No background image": "Không có ảnh nền",
  "Dim overlay": "Lớp phủ tối",
  "Use the native window title bar": "Dùng thanh tiêu đề cửa sổ gốc",
  "Bokeh background": "Nền bokeh",
  "Pick a layout, set colors and fonts, save it to your library. No code needed.":
    "Chọn bố cục, đặt màu sắc và phông chữ, rồi lưu vào thư viện. Không cần viết mã.",
  "Open studio": "Mở studio",
  "Every variable, selector, hook, and recipe for building custom Harbor themes.":
    "Toàn bộ biến, bộ chọn, hook và công thức để tạo giao diện Harbor tùy chỉnh.",
  "Make your own in the Theme Studio, or import one a friend shared.":
    "Tự tạo trong Theme Studio hoặc nhập giao diện do bạn bè chia sẻ.",
  "Open library": "Mở thư viện",
  "Build a Theme": "Tạo giao diện",
  "Pick a layout, set colors and fonts. No code needed.":
    "Chọn bố cục, đặt màu sắc và phông chữ. Không cần viết mã.",
  "Import a Theme": "Nhập giao diện",
  "Got a theme a friend shared? Drop it in.": "Có giao diện do bạn bè chia sẻ? Thả vào đây.",
  "Choose file": "Chọn tệp",
  "Window title bar": "Thanh tiêu đề cửa sổ",
  "Use your operating system's native title bar and window buttons instead of Harbor's built-in ones. Handy if the in-app buttons ever feel out of reach, like during playback.":
    "Dùng thanh tiêu đề và các nút cửa sổ gốc của hệ điều hành thay cho các nút tích hợp của Harbor. Hữu ích khi các nút trong ứng dụng khó thao tác, chẳng hạn lúc đang phát.",
  "{name} imported to your library": "Đã nhập {name} vào thư viện",
  "Click any binding to rebind it. Press Esc while capturing to cancel. Letters ignore Shift (so K and Shift+K trigger the same action).":
    "Nhấp vào phím tắt bất kỳ để gán lại. Nhấn Esc trong khi ghi nhận để hủy. Các chữ cái bỏ qua Shift (vì vậy K và Shift+K kích hoạt cùng một thao tác).",
  Global: "Toàn cục",
  "Anywhere in Harbor.": "Ở mọi nơi trong Harbor.",
  NAVIGATION: "ĐIỀU HƯỚNG",
  PLAYBACK: "PHÁT",
  VOLUME: "ÂM LƯỢNG",
  TRACKS: "RÃNH",
  SPEED: "TỐC ĐỘ",
  PANELS: "BẢNG ĐIỀU KHIỂN",
  Conflict: "Xung đột",
  "Press a key…": "Nhấn một phím…",
  "Focus search": "Chuyển đến ô tìm kiếm",
  "Jump to the top-bar search from anywhere.":
    "Chuyển đến ô tìm kiếm trên thanh trên cùng từ bất kỳ đâu.",
  "Open Harbor's settings outside playback.": "Mở Cài đặt của Harbor khi không phát.",
  "Your face in Watch Together rooms, sessions, and chat. Sits on top of your Stremio account.":
    "Ảnh đại diện của bạn trong các phòng, phiên và cuộc trò chuyện Xem cùng nhau. Được hiển thị trên tài khoản Stremio của bạn.",
  "Use my AniList avatar as my Harbor avatar": "Dùng ảnh đại diện AniList làm ảnh đại diện Harbor",
  "Use my Trakt avatar as my Harbor avatar": "Dùng ảnh đại diện Trakt làm ảnh đại diện Harbor",
  "Use my Simkl avatar as my Harbor avatar": "Dùng ảnh đại diện Simkl làm ảnh đại diện Harbor",
  "Not signed in": "Chưa đăng nhập",
  "addon synced": "đã đồng bộ tiện ích bổ sung",
  "addons synced": "đã đồng bộ các tiện ích bổ sung",
  "Sync now": "Đồng bộ ngay",
  "Syncing…": "Đang đồng bộ…",
  "Stremio ID": "Stremio ID",
  "Re-authenticate": "Xác thực lại",
  "Sign in to sync your library, watch progress, and addons.":
    "Đăng nhập để đồng bộ thư viện, tiến độ xem và các tiện ích bổ sung.",
  "Deploy your relay": "Triển khai relay của bạn",
  "Spins up a tiny server on Cloudflare's free Workers tier. Stays online forever (or until you stop it). Friends connect by URL.":
    "Khởi chạy một máy chủ nhỏ trên gói Workers miễn phí của Cloudflare. Máy chủ sẽ luôn trực tuyến (hoặc cho đến khi bạn dừng). Bạn bè kết nối qua URL.",
  "Click the button below. It opens Cloudflare's token page in your browser. Sign in (free, takes 30 seconds if you don't have an account).":
    "Nhấp vào nút bên dưới. Trang token của Cloudflare sẽ mở trong trình duyệt. Đăng nhập (miễn phí, chỉ mất 30 giây nếu bạn chưa có tài khoản).",
  "Fill the top of the form to look exactly like this:":
    "Điền phần đầu biểu mẫu giống hệt như sau:",
  "Open Cloudflare token page": "Mở trang token Cloudflare",
  "I have my token": "Tôi đã có token",
  "40-character token": "Token 40 ký tự",
  "Which account should the relay live in?": "Bạn muốn đặt relay trong tài khoản nào?",
  "Uploading worker, wiring durable object…": "Đang tải worker lên và kết nối durable object…",
  "Takes about 10 seconds.": "Mất khoảng 10 giây.",
  "Relay is live": "Relay đã hoạt động",
  "URL is saved and ready to share.": "URL đã được lưu và sẵn sàng chia sẻ.",
  "Your relay URL": "URL relay của bạn",
  "Copied. Paste it to your friend.": "Đã sao chép. Hãy gửi cho bạn bè.",
  "Send this to anyone you want to watch with. They paste it in their Settings → Harbor Relay. After that, share a 6-character room code from the people icon up top.":
    "Gửi URL này cho bất kỳ ai bạn muốn xem cùng. Họ dán URL vào Cài đặt → Harbor Relay. Sau đó, chia sẻ mã phòng gồm 6 ký tự từ biểu tượng mọi người ở phía trên.",
  "One last thing on Cloudflare's side": "Còn một bước cuối trên Cloudflare",
  "Click the button below to open Cloudflare's Workers page.":
    "Nhấp vào nút bên dưới để mở trang Workers của Cloudflare.",
  "Open Cloudflare Workers": "Mở Cloudflare Workers",
  "Try deploy again": "Thử triển khai lại",
  "Paste your API token first.": "Trước tiên, hãy dán API token.",
  "Token works, but no accounts came back. Check the token's permissions.":
    "Token hợp lệ nhưng không trả về tài khoản nào. Hãy kiểm tra quyền của token.",
  "No Cloudflare accounts found for this token.":
    "Không tìm thấy tài khoản Cloudflare nào cho token này.",
  "Connect your Trakt account": "Kết nối tài khoản Trakt",
  "Connect Trakt": "Kết nối Trakt",
  "About Trakt": "Giới thiệu về Trakt",
  "Harbor will scrobble your playback to Trakt and sync your watchlist.":
    "Harbor sẽ ghi nhận hoạt động phát của bạn trên Trakt và đồng bộ danh sách xem.",
  Authorized: "Đã cấp quyền",
  "Open profile": "Mở hồ sơ",
  "Wear your Trakt profile picture across Harbor instead of the default.":
    "Dùng ảnh hồ sơ Trakt của bạn trên Harbor thay cho ảnh mặc định.",
  "Disconnect from Trakt": "Ngắt kết nối Trakt",
  "Disconnect Trakt? Scrobbles and syncs will stop until you reconnect.":
    "Ngắt kết nối Trakt? Việc ghi nhận hoạt động xem và đồng bộ sẽ dừng cho đến khi bạn kết nối lại.",
  Disconnect: "Ngắt kết nối",
  "Blur comments by default": "Mặc định làm mờ bình luận",
  "Comments on episode/show pages are blurred until you reveal them, even if they are not tagged as spoilers.":
    "Bình luận trên trang tập/phim bộ sẽ bị làm mờ cho đến khi bạn hiển thị, ngay cả khi không được gắn nhãn tiết lộ nội dung.",
  "Comments on anime pages are blurred until you reveal them, even if they are not tagged as spoilers.":
    "Bình luận trên trang anime sẽ bị làm mờ cho đến khi bạn hiển thị, ngay cả khi không được gắn nhãn tiết lộ nội dung.",
  "Show AniList comments": "Hiển thị bình luận AniList",
  "Show forum threads and comments from AniList on anime detail pages.":
    "Hiển thị chủ đề diễn đàn và bình luận từ AniList trên trang chi tiết anime.",
  today: "hôm nay",
  "Connect your Simkl account": "Kết nối tài khoản Simkl",
  "Connect Simkl": "Kết nối Simkl",
  "About Simkl": "Giới thiệu về Simkl",
  "Harbor will mark what you finish as watched on Simkl and sync your plan-to-watch list.":
    "Harbor sẽ đánh dấu nội dung bạn xem xong là đã xem trên Simkl và đồng bộ danh sách dự định xem.",
  "Authorized on this device": "Đã cấp quyền trên thiết bị này",
  "Wear your Simkl profile picture across Harbor instead of the default.":
    "Dùng ảnh hồ sơ Simkl của bạn trên Harbor thay cho ảnh mặc định.",
  "Disconnect from Simkl": "Ngắt kết nối Simkl",
  "Disconnect Simkl? Syncing will stop until you reconnect.":
    "Ngắt kết nối Simkl? Việc đồng bộ sẽ dừng cho đến khi bạn kết nối lại.",
  "Connect your AniList account": "Kết nối tài khoản AniList",
  "Connect AniList": "Kết nối AniList",
  "About AniList": "Giới thiệu về AniList",
  "Harbor shows your AniList lists on the Anime page and keeps your progress in sync.":
    "Harbor hiển thị các danh sách AniList của bạn trên trang Anime và đồng bộ tiến độ xem.",
  "Sync watch progress": "Đồng bộ tiến độ xem",
  "Finishing an anime episode updates your AniList progress. Forward only: it never lowers a count you already have.":
    "Khi xem xong một tập anime, tiến độ AniList của bạn sẽ được cập nhật. Chỉ tăng tiến độ: số tập hiện có sẽ không bao giờ bị giảm.",
  "Show your AniList profile picture as your Harbor avatar.":
    "Dùng ảnh hồ sơ AniList làm ảnh đại diện Harbor của bạn.",
  "Disconnect from AniList": "Ngắt kết nối AniList",
  "Discord webhook URL": "URL webhook Discord",
  Sources: "Nguồn",
  "Pick which calendars feed your webhook. Items are deduped across sources before sending.":
    "Chọn lịch dùng để cung cấp dữ liệu cho webhook. Các mục trùng lặp giữa các nguồn sẽ được loại bỏ trước khi gửi.",
  "Filter by media type after the sources merge. Leave them all on to send everything.":
    "Lọc theo loại nội dung sau khi hợp nhất các nguồn. Bật tất cả để gửi mọi nội dung.",
  "Episodes and movies from shows you've saved on Stremio.":
    "Các tập và phim điện ảnh từ những phim bộ bạn đã lưu trên Stremio.",
  "Sign in to Stremio first.": "Hãy đăng nhập Stremio trước.",
  "All upcoming": "Tất cả nội dung sắp ra mắt",
  "Everything releasing in the current month from TMDB.":
    "Mọi nội dung ra mắt trong tháng hiện tại từ TMDB.",
  "Add a TMDB key in Library settings.": "Thêm khóa TMDB trong Cài đặt thư viện.",
  "My Trakt": "Trakt của tôi",
  "Upcoming episodes and movies from your Trakt watchlist.":
    "Các tập và phim điện ảnh sắp ra mắt trong danh sách xem Trakt của bạn.",
  "Connect Trakt first.": "Hãy kết nối Trakt trước.",
  "The most anticipated upcoming releases on Trakt. No login needed.":
    "Những nội dung sắp ra mắt được mong đợi nhất trên Trakt. Không cần đăng nhập.",
  "Anything matching your Custom calendar: tracked people, genres, providers, countries.":
    "Mọi nội dung khớp với lịch Tùy chỉnh: người được theo dõi, thể loại, nhà cung cấp, quốc gia.",
  "Sent. Check your channel.": "Đã gửi. Hãy kiểm tra kênh của bạn.",
  "Each rule fires independently. Define what triggers a ping and where it goes.":
    "Mỗi quy tắc hoạt động độc lập. Xác định điều kiện kích hoạt thông báo và nơi gửi đến.",
  "New rule": "Quy tắc mới",
  "Add a Discord or Telegram URL above before creating rules.":
    "Thêm URL Discord hoặc Telegram ở trên trước khi tạo quy tắc.",
  "No automations yet. Hit New rule to wire one up.":
    "Chưa có quy trình tự động nào. Nhấn Quy tắc mới để thiết lập.",
  "Discord posts a message to a channel whenever Harbor pings it. Takes about a minute to set up.":
    "Discord đăng tin nhắn lên một kênh mỗi khi nhận được tín hiệu từ Harbor. Chỉ mất khoảng một phút để thiết lập.",
  "Open the Discord server where you want notifications to land.":
    "Mở máy chủ Discord mà bạn muốn nhận thông báo.",
  "Edit Channel": "Chỉnh sửa kênh",
  Integrations: "Tích hợp",
  "New Webhook": "Webhook mới",
  "Copy Webhook URL": "Sao chép URL webhook",
  "Paste the URL into the box above and send a test.": "Dán URL vào ô phía trên và gửi thử.",
  "No Integrations option? You need the Manage Webhooks permission. Ask whoever owns the server.":
    "Không thấy tùy chọn Tích hợp? Bạn cần quyền Quản lý webhook. Hãy hỏi chủ sở hữu máy chủ.",
  "Open Discord's webhook help": "Mở trợ giúp webhook của Discord",
  "Telegram bot": "Bot Telegram",
  "bot token": "token bot",
  "chat ID": "ID cuộc trò chuyện",
  "Open BotFather": "Mở BotFather",
  "Bot token": "Token bot",
  "Open the bot BotFather just made (he sends you a link). Send it any message so it's allowed to message you back.":
    "Mở bot mà BotFather vừa tạo (BotFather sẽ gửi cho bạn một liên kết). Gửi cho bot một tin nhắn bất kỳ để bot có thể nhắn lại cho bạn.",
  "Open userinfobot": "Mở userinfobot",
  "Chat ID": "ID cuộc trò chuyện",
  "Send test": "Gửi thử",
  "Open Settings": "Mở Cài đặt",
  "Open Library settings": "Mở Cài đặt thư viện",
  "add one in settings": "thêm trong Cài đặt",
  "Using AIOStreams or another aggregator addon? Its own sorting and filtering happen inside the addon before Harbor ever sees the results, then Harbor applies the stream filter and result order above on top. If results look thinner than expected, keep one side permissive: either relax the addon's internal filters or set Harbor's stream filter to Balanced or Off.":
    "Bạn đang dùng AIOStreams hoặc tiện ích bổ sung tổng hợp khác? Việc sắp xếp và lọc riêng sẽ diễn ra trong tiện ích bổ sung trước khi Harbor nhận kết quả, sau đó Harbor tiếp tục áp dụng bộ lọc luồng phát và thứ tự kết quả ở trên. Nếu kết quả ít hơn dự kiến, hãy để một bên thoáng hơn: nới lỏng bộ lọc nội bộ của tiện ích bổ sung hoặc đặt bộ lọc luồng phát của Harbor thành Cân bằng hoặc Tắt.",
  "Easynews+": "Easynews+",
  "{n} services need attention": "{n} dịch vụ cần được xử lý",
  "Health for {n} services below": "Tình trạng của {n} dịch vụ bên dưới",
  "{n}d left": "còn {n} ngày",
  "Save a TMDB key in Library & metadata to turn on streaming catalogs.":
    "Lưu khóa TMDB trong Thư viện & siêu dữ liệu để bật danh mục phát trực tuyến.",
  "Sign in to Stremio first. Your installed addons sync from there.":
    "Hãy đăng nhập Stremio trước. Các tiện ích bổ sung đã cài đặt sẽ được đồng bộ từ đó.",
  Manage: "Quản lý",
  "Last synced {n}s ago.": "Đồng bộ lần cuối cách đây {n} giây.",
  "Show {n} more addons": "Hiển thị thêm {n} tiện ích bổ sung",
  "All addons ({n})": "Tất cả tiện ích bổ sung ({n})",
  "Harbor identity": "Danh tính Harbor",
  "New profile": "Hồ sơ mới",
  "Upload photo": "Tải ảnh lên",
  Confirm: "Xác nhận",
  "{n} tab locked": "Thẻ {n} đã khóa",
  PIN: "PIN",
  Change: "Thay đổi",
  "{n} tab requires this profile's PIN.": "Thẻ {n} yêu cầu PIN của hồ sơ này.",
  "Play button behavior": "Cách hoạt động của nút Phát",
  "Choose what happens when you hit Play on a title. Manual gives you full control over quality and source.":
    "Chọn điều sẽ xảy ra khi bạn nhấn Phát trên một nội dung. Chế độ Thủ công cho phép bạn toàn quyền chọn chất lượng và nguồn.",
  "Player engine": "Trình phát",
  "HTML5 plays everything WebView2 supports. mpv handles TrueHD, DTS-HD, AV1, weird containers, and HDR. Auto picks based on the source.":
    "HTML5 phát mọi định dạng WebView2 hỗ trợ. mpv xử lý TrueHD, DTS-HD, AV1, các container ít phổ biến và HDR. Tự động sẽ chọn dựa trên nguồn.",
  "Seek bar": "Thanh tua",
  "Style the timeline at the bottom of the player. Swap the dot for a sticker, change the bar height, recolor it. Settings live-preview right here.":
    "Tùy chỉnh dòng thời gian ở cuối trình phát. Thay dấu chấm bằng nhãn dán, đổi chiều cao và màu thanh. Xem trước Cài đặt ngay tại đây.",
  "Subtitle style": "Kiểu phụ đề",
  "How subtitles look during playback. Live preview below.":
    "Giao diện phụ đề khi phát. Xem trước trực tiếp bên dưới.",
  "Show format chips on stream rows": "Hiện nhãn định dạng trên các hàng luồng phát",
  "The picker tags each stream with resolution, HDR flavor, codec, and audio format. Off hides them all.":
    "Trình chọn gắn nhãn cho từng luồng phát theo độ phân giải, loại HDR, codec và định dạng âm thanh. Tắt để ẩn tất cả.",
  "Poster size": "Kích thước áp phích",
  "Scale every poster and card across Home, Discover, and your library. Bump it up on a 4K or large display where the defaults feel small, or shrink it for a denser grid.":
    "Điều chỉnh kích thước mọi áp phích và thẻ trên Trang chủ, Khám phá và thư viện. Tăng kích thước trên màn hình 4K hoặc màn hình lớn nếu mặc định quá nhỏ, hoặc giảm để lưới hiển thị dày hơn.",
  Compact: "Gọn",
  Large: "Lớn",
  Huge: "Rất lớn",
  Accessibility: "Trợ năng",
  "Make everything bigger and easier to read: sidebar, menus, popups, every page. The whole interface scales live as you drag, so you can see the change right here. Great on 4K and ultrawide monitors, or whenever the text feels small.":
    "Phóng to mọi thứ để dễ đọc hơn: thanh bên, menu, cửa sổ bật lên và mọi trang. Toàn bộ giao diện thay đổi kích thước trực tiếp khi bạn kéo, nên có thể xem ngay thay đổi tại đây. Rất phù hợp với màn hình 4K, siêu rộng hoặc bất cứ khi nào chữ quá nhỏ.",
  "Interface scale": "Tỷ lệ giao diện",
  "Trailer quality": "Chất lượng trailer",
  "How sharp the trailer is when you hit the preview button. Auto picks from your connection speed. 1080p and Best merge separate video and audio with the bundled ffmpeg, so they take a beat longer to start.":
    "Độ nét của trailer khi bạn nhấn nút xem trước. Tự động chọn theo tốc độ kết nối. 1080p và Tốt nhất ghép video và âm thanh riêng bằng ffmpeg đi kèm, nên sẽ mất thêm chút thời gian để bắt đầu.",
  Auto: "Tự động",
  Best: "Tốt nhất",
  Audio: "Âm thanh",
  "Shape the sound without touching your system EQ. Applies on the mpv engine; the HTML5 engine plays audio untouched.":
    "Điều chỉnh âm thanh mà không cần thay đổi EQ hệ thống. Áp dụng với trình phát mpv; trình phát HTML5 giữ nguyên âm thanh.",
  "Normalize loudness": "Cân bằng âm lượng",
  "Maximum volume boost": "Mức tăng âm lượng tối đa",
  "How far you can boost past 100 percent on the volume bar. Higher settings can get very loud.":
    "Mức có thể tăng vượt quá 100 phần trăm trên thanh âm lượng. Cài đặt cao hơn có thể tạo âm lượng rất lớn.",
  "Evens out quiet dialogue and loud action scenes with a dynamic normalizer.":
    "Cân bằng lời thoại nhỏ và cảnh hành động lớn tiếng bằng bộ chuẩn hóa động.",
  Flat: "Cân bằng",
  "Bass boost": "Tăng âm trầm",
  "Vocal clarity": "Làm rõ giọng nói",
  "Less bass": "Giảm âm trầm",
  "Night mode": "Chế độ ban đêm",
  "Night mode gently compresses loud moments for late-night watching. Profiles take effect when the next track loads and stack with the normalizer.":
    "Chế độ ban đêm nén nhẹ những đoạn âm thanh lớn để xem khuya. Cấu hình có hiệu lực khi tải bản âm thanh tiếp theo và được kết hợp với bộ chuẩn hóa.",
  "Skip intros": "Bỏ qua phần mở đầu",
  "Harbor finds intro and credits timing from AniSkip, TheIntroDB, and the file's own chapters, then shows a Skip button at the right moment.":
    "Harbor lấy thời điểm phần mở đầu và danh đề từ AniSkip, TheIntroDB cùng các chương trong tệp, rồi hiện nút Bỏ qua đúng lúc.",
  "Auto-skip intros": "Tự động bỏ qua phần mở đầu",
  "Jump past openings automatically the moment one starts. The Skip button still shows either way, and seeking back into an intro replays it without skipping again.":
    "Tự động chuyển qua phần mở đầu ngay khi bắt đầu. Nút Bỏ qua vẫn luôn hiển thị, và nếu tua lại phần mở đầu thì nội dung sẽ phát lại mà không bị bỏ qua lần nữa.",
  "Next episode prompt": "Nhắc tập tiếp theo",
  "When the Up Next pill appears before an episode ends. Auto scales to the episode length, so short episodes stop prompting so early. Off hides it.":
    "Thời điểm nhãn Tập tiếp theo xuất hiện trước khi tập kết thúc. Tự động điều chỉnh theo độ dài tập để không nhắc quá sớm với các tập ngắn. Tắt để ẩn.",
  "30s": "30 giây",
  "45s": "45 giây",
  "1 min": "1 phút",
  "1.5 min": "1,5 phút",
  "2 min": "2 phút",
  "Where Harbor saves videos when you hit Download in the player. Pick any folder, including one on a different drive.":
    "Vị trí Harbor lưu video khi bạn nhấn Tải xuống trong trình phát. Chọn thư mục bất kỳ, kể cả trên ổ đĩa khác.",
  HTML5: "HTML5",
  mpv: "mpv",
  "Anime4K upscaling": "Nâng cấp độ phân giải bằng Anime4K",
  Flat_Style: "Flat_Style",
  Background: "Nền",
  "{name} will be removed from Harbor. Anything you've set to use it will fall back to Inter.":
    "{name} sẽ bị xóa khỏi Harbor. Mọi mục được đặt để sử dụng phông chữ này sẽ chuyển về Inter.",
  "Player & quality": "Trình phát và chất lượng",
  "Pick the playback engine and which quality chips show up on cards.":
    "Chọn công cụ phát và các nhãn chất lượng hiển thị trên thẻ.",
  Starting: "Đang khởi động",
  "Not running": "Chưa chạy",
  "Start server": "Khởi động máy chủ",
  "Your streaming server address": "Địa chỉ máy chủ phát trực tuyến của bạn",
  "Harbor runs a small streaming server right on this computer. This is where it lives. To stream from this machine on another device, copy the Wi-Fi address and paste it into Remote streaming server in Harbor over there.":
    "Harbor chạy một máy chủ phát trực tuyến nhỏ ngay trên máy tính này. Đây là địa chỉ của máy chủ. Để phát từ máy này trên thiết bị khác, hãy sao chép địa chỉ Wi-Fi rồi dán vào Máy chủ phát trực tuyến từ xa trong Harbor trên thiết bị đó.",
  "On this computer": "Trên máy tính này",
  "From other devices on your Wi-Fi": "Từ các thiết bị khác trên Wi-Fi của bạn",
  "Harbor in your browser": "Harbor trong trình duyệt",
  "Serves this exact install of Harbor as a web app on your network. Open it on a phone, laptop, or TV browser, sign in there, and it streams through this computer.":
    "Cung cấp chính bản cài đặt Harbor này dưới dạng ứng dụng web trên mạng của bạn. Mở ứng dụng trong trình duyệt trên điện thoại, máy tính xách tay hoặc TV, đăng nhập tại đó và nội dung sẽ được phát qua máy tính này.",
  "From any browser on your Wi-Fi": "Từ mọi trình duyệt trên Wi-Fi của bạn",
  "Couldn't start on port {WEB_PORT}. Another app may be using it; toggle off and on to retry.":
    "Không thể khởi động trên cổng {WEB_PORT}. Có thể một ứng dụng khác đang sử dụng cổng này; hãy tắt rồi bật lại để thử lại.",
  Connected: "Đã kết nối",
  "Custom CSS": "CSS tùy chỉnh",
  "Live-injected into the document. Use it to retheme buttons, change spacing, recolor anything.":
    "Được chèn trực tiếp vào tài liệu. Dùng để đổi giao diện nút, điều chỉnh khoảng cách hoặc đổi màu bất kỳ thành phần nào.",
  "Custom JS": "JS tùy chỉnh",
  "Runs in the app's WebView. You're modding your own client. No sandbox, no safety net. Errors land in the console.":
    "Chạy trong WebView của ứng dụng. Bạn đang tự sửa đổi ứng dụng khách của mình. Không có sandbox hay cơ chế bảo vệ. Lỗi sẽ xuất hiện trong bảng điều khiển.",
  "Custom HTML overlay": "Lớp phủ HTML tùy chỉnh",
  "Injected into a fixed-position layer above the app (pointer-events disabled by default). Wrap in a div with pointer-events:auto to make it interactive.":
    "Được chèn vào một lớp có vị trí cố định phía trên ứng dụng (pointer-events mặc định bị tắt). Bọc trong div có pointer-events:auto để cho phép tương tác.",
  "Custom code": "Mã tùy chỉnh",
  "Power-user knob. Inject your own CSS, JS, and HTML into Harbor. Lives in your local settings; nothing leaves your machine.":
    "Tùy chọn dành cho người dùng nâng cao. Chèn CSS, JS và HTML của riêng bạn vào Harbor. Mã được lưu trong cài đặt cục bộ và không rời khỏi máy của bạn.",
  "You're modding your own client. Custom JS has full access to your Harbor session. Only paste code you wrote or fully trust.":
    "Bạn đang tự sửa đổi ứng dụng khách của mình. JS tùy chỉnh có toàn quyền truy cập vào phiên Harbor của bạn. Chỉ dán mã do bạn viết hoặc hoàn toàn tin cậy.",
  "{n} chars": "{n} ký tự",
  "Player layout": "Bố cục trình phát",
  "Pick a theme, then rearrange every button in the player chrome. Hide what you never use, promote what you do.":
    "Chọn một giao diện, sau đó sắp xếp lại mọi nút trên thanh điều khiển trình phát. Ẩn nút bạn không dùng và ưu tiên nút thường dùng.",
  "Click any control in the live preview to move, hide, or reorder it.":
    "Nhấp vào bất kỳ nút điều khiển nào trong bản xem trước trực tiếp để di chuyển, ẩn hoặc sắp xếp lại.",
  Profile: "Hồ sơ",
  visible: "hiển thị",
  hidden: "ẩn",
  "on the {themeName} theme.": "trên giao diện {themeName}.",
  "Edit player layout": "Chỉnh sửa bố cục trình phát",
  "Harbor's native player chrome.": "Thanh điều khiển trình phát gốc của Harbor.",
  Stremio: "Stremio",
  "Familiar Stremio button order.": "Thứ tự nút quen thuộc của Stremio.",
  "Confirm full reset": "Xác nhận đặt lại toàn bộ",
  "Reset all to default": "Đặt lại tất cả về mặc định",
  "Discard changes": "Hủy thay đổi",
  "Designing the player layout": "Đang thiết kế bố cục trình phát",
  "Customizing the player": "Đang tùy chỉnh trình phát",
  "Couldn't save your layout. {error}": "Không thể lưu bố cục. {error}",
  "You have unsaved changes that will be lost when switching profiles. Continue?":
    "Bạn có các thay đổi chưa lưu và chúng sẽ bị mất khi chuyển hồ sơ. Tiếp tục?",
  "Couldn't switch profile. {error}": "Không thể chuyển hồ sơ. {error}",
  "Couldn't create the profile. {error}": "Không thể tạo hồ sơ. {error}",
  "Couldn't rename the profile. {error}": "Không thể đổi tên hồ sơ. {error}",
  "Delete this profile permanently? This cannot be undone.":
    "Xóa vĩnh viễn hồ sơ này? Không thể hoàn tác thao tác này.",
  "Couldn't delete the profile. {error}": "Không thể xóa hồ sơ. {error}",
  "Couldn't import that file. {error}": "Không thể nhập tệp đó. {error}",
  "You have unsaved changes. Close the editor and discard them?":
    "Bạn có các thay đổi chưa lưu. Đóng trình chỉnh sửa và hủy các thay đổi?",
  "Time format": "Định dạng thời gian",
  "What the clock labels show on the seek bar.": "Nhãn thời gian hiển thị gì trên thanh tua.",
  "Elapsed and remaining": "Đã phát và còn lại",
  "00:23 on the left, -1:12 on the right.": "00:23 ở bên trái, -1:12 ở bên phải.",
  "Remaining only": "Chỉ thời gian còn lại",
  "Single -1:12 label, both ends collapse.": "Một nhãn -1:12, hai đầu thu gọn.",
  "Elapsed only": "Chỉ thời gian đã phát",
  "Single 00:23 label, both ends collapse.": "Một nhãn 00:23, hai đầu thu gọn.",
  "Volume control": "Điều khiển âm lượng",
  "How the volume widget behaves on click and hover.":
    "Cách tiện ích âm lượng phản hồi khi nhấp và di chuột qua.",
  Slider: "Thanh trượt",
  "Hover the speaker to reveal a horizontal slider.":
    "Di chuột qua biểu tượng loa để hiện thanh trượt ngang.",
  Stepper: "Theo mức",
  "Click to cycle 100 / 75 / 50 / 25 / 0.": "Nhấp để chuyển lần lượt 100 / 75 / 50 / 25 / 0.",
  "Icon only": "Chỉ biểu tượng",
  "Click toggles mute. Wheel scrolls volume.":
    "Nhấp để bật/tắt tiếng. Cuộn con lăn để chỉnh âm lượng.",
  "Back to relay": "Quay lại relay",
  Documentation: "Tài liệu",
  "Self-host": "Tự lưu trữ",
  "Run your own Harbor Relay": "Chạy Harbor Relay của riêng bạn",
  "Two paths: Harbor handles the deploy for you, or you do it yourself with wrangler.":
    "Có hai cách: để Harbor triển khai cho bạn hoặc tự triển khai bằng wrangler.",
  "The Harbor relay is a Cloudflare Worker that hosts WebSocket rooms for Watch Together. Each user runs their own. There is no central Harbor server.":
    "Harbor relay là một Cloudflare Worker lưu trữ các phòng WebSocket cho Xem cùng nhau. Mỗi người dùng chạy relay riêng. Không có máy chủ Harbor trung tâm.",
  "Source: {code}. About 200 lines of JavaScript, no dependencies. Read it before deploying if you want to know what runs.":
    "Mã nguồn: {code}. Khoảng 200 dòng JavaScript, không có phần phụ thuộc. Hãy đọc trước khi triển khai nếu muốn biết mã nào sẽ chạy.",
  Requirements: "Yêu cầu",
  "A free Cloudflare account.": "Một tài khoản Cloudflare miễn phí.",
  "About two minutes for the auto-deploy path.": "Khoảng hai phút nếu triển khai tự động.",
  "For the manual path: {code} 20+ and {code} CLI.":
    "Nếu triển khai thủ công: {code} 20+ và CLI {code}.",
  "Auto-deploy from Harbor": "Tự động triển khai từ Harbor",
  "Easiest path. Harbor uploads the worker, creates the Durable Object namespace, and stores the resulting URL.":
    "Cách dễ nhất. Harbor tải worker lên, tạo không gian tên Durable Object và lưu URL nhận được.",
  "Open Settings, then Harbor Relay.": "Mở Cài đặt, rồi chọn Harbor Relay.",
  "Click {kbd}.": "Nhấp vào {kbd}.",
  "Generate a Cloudflare API token with {code1} and {code2} permissions at {code3}. Paste it into Harbor.":
    "Tạo token Cloudflare API có quyền {code1} và {code2} tại {code3}. Dán token vào Harbor.",
  "Pick the Cloudflare account to deploy under.": "Chọn tài khoản Cloudflare để triển khai.",
  "Wait for the upload to finish. The relay URL gets written to {code} in Harbor settings.":
    "Chờ tải lên hoàn tất. URL relay sẽ được ghi vào {code} trong phần cài đặt Harbor.",
  "Manual deploy with wrangler": "Triển khai thủ công bằng wrangler",
  "For users who want to deploy themselves or already have a wrangler workflow.":
    "Dành cho người dùng muốn tự triển khai hoặc đã có quy trình làm việc với wrangler.",
  "Install wrangler and authenticate:": "Cài đặt wrangler và xác thực:",
  "Save the worker source. Copy {code1} from the Harbor repo into a new directory as {code2}.":
    "Lưu mã nguồn worker. Sao chép {code1} từ kho mã Harbor vào một thư mục mới dưới tên {code2}.",
  "Save this {code} next to it:": "Lưu {code} này bên cạnh tệp đó:",
  "Deploy:": "Triển khai:",
  "Note the URL Cloudflare returns. It looks like {code}.":
    "Ghi lại URL do Cloudflare trả về. URL có dạng {code}.",
  "In Harbor: Settings, Harbor Relay, then {kbd}. Paste the URL with {code1} as the scheme instead of {code2}.":
    "Trong Harbor: Cài đặt, Harbor Relay, rồi {kbd}. Dán URL với lược đồ {code1} thay cho {code2}.",
  "Verify it works": "Xác minh hoạt động",
  "Settings, Harbor Relay, then {kbd}.": "Cài đặt, Harbor Relay, rồi {kbd}.",
  "The test calls {code} and confirms the worker is reachable and running a current version. A passing test means Watch Together rooms will connect.":
    "Bài kiểm tra gọi {code} và xác nhận worker có thể truy cập được cũng như đang chạy phiên bản hiện tại. Nếu kiểm tra thành công, các phòng Xem cùng nhau sẽ kết nối được.",
  "If the Watch Together popover shows an outdated-relay banner, redeploying with the steps above is the fix. The banner clears automatically the next time you connect once the relay reports the current version.":
    "Nếu cửa sổ bật lên Xem cùng nhau hiển thị biểu ngữ relay lỗi thời, hãy triển khai lại theo các bước trên. Biểu ngữ sẽ tự động biến mất trong lần kết nối tiếp theo khi relay báo phiên bản hiện tại.",
  "Sharing your relay": "Chia sẻ relay",
  "A relay URL is shareable. Anyone with the URL can join Watch Together rooms hosted on your relay. The unique {code} subdomain acts as the access token. There is no login.":
    "Bạn có thể chia sẻ URL relay. Bất kỳ ai có URL đều có thể tham gia các phòng Xem cùng nhau được lưu trữ trên relay của bạn. Tên miền phụ {code} duy nhất đóng vai trò là token truy cập. Không cần đăng nhập.",
  "To run a public relay, post the {code} URL on r/Stremio or wherever your community lives. Other Harbor users paste it into Settings, Harbor Relay, {kbd}.":
    "Để chạy relay công khai, hãy đăng URL {code} lên r/Stremio hoặc nơi cộng đồng của bạn hoạt động. Người dùng Harbor khác dán URL vào Cài đặt, Harbor Relay, {kbd}.",
  Costs: "Chi phí",
  "Cloudflare Workers free tier:": "Gói miễn phí của Cloudflare Workers:",
  "100,000 requests per day.": "100.000 yêu cầu mỗi ngày.",
  "10ms CPU time per request.": "10ms thời gian CPU cho mỗi yêu cầu.",
  "Unlimited Durable Object storage at $0.20 per million reads.":
    "Dung lượng lưu trữ Durable Object không giới hạn với mức phí $0.20 cho mỗi một triệu lượt đọc.",
  "A typical Watch Together session uses a few hundred messages per hour. Solo and small-group use stays well under free tier limits.":
    "Một phiên Xem cùng nhau thông thường sử dụng vài trăm tin nhắn mỗi giờ. Khi dùng một mình hoặc theo nhóm nhỏ, mức sử dụng vẫn thấp hơn nhiều so với giới hạn của gói miễn phí.",
  "If you exceed free tier, the Workers Paid plan is $5 per month and bumps the request allowance to 10 million per day.":
    "Nếu vượt quá gói miễn phí, gói Workers Paid có giá 5 USD mỗi tháng và tăng hạn mức yêu cầu lên 10 triệu mỗi ngày.",
  Troubleshooting: "Khắc phục sự cố",
  Symptom: "Dấu hiệu",
  Cause: "Nguyên nhân",
  Fix: "Cách khắc phục",
  "Health check returns 5xx": "Kiểm tra tình trạng trả về lỗi 5xx",
  "Worker crashed or hit memory limits": "Worker gặp sự cố hoặc đạt giới hạn bộ nhớ",
  "Check logs in Cloudflare dashboard, then redeploy":
    "Kiểm tra nhật ký trong bảng điều khiển Cloudflare, rồi triển khai lại",
  "Connection refused / DNS does not resolve": "Kết nối bị từ chối / DNS không phân giải được",
  "Worker deleted or URL wrong": "Worker đã bị xóa hoặc URL không đúng",
  "Re-run deploy or paste the correct URL": "Chạy lại quy trình triển khai hoặc dán đúng URL",
  "Watch Together rooms drop after 6 hours": "Phòng Xem cùng nhau bị ngắt sau 6 giờ",
  "Durable Object idle eviction": "Durable Object bị thu hồi khi không hoạt động",
  "Expected. Rooms recreate on next join.":
    "Đây là điều bình thường. Phòng sẽ được tạo lại khi có người tham gia tiếp theo.",
  "What the worker does": "Chức năng của worker",
  "{code}: returns JSON with the worker version. Used by the test button.":
    "{code}: trả về JSON chứa phiên bản worker. Được nút kiểm tra sử dụng.",
  "{code} with a WebSocket upgrade: opens a Watch Together room. State is held in a Durable Object, no persistence beyond the active session.":
    "{code} với nâng cấp WebSocket: mở một phòng Xem cùng nhau. Trạng thái được lưu trong Durable Object và không tồn tại sau phiên hoạt động.",
  "Saving…": "Đang lưu…",
  "Plain text (.txt)": "Văn bản thuần túy (.txt)",
  "JSON (.json)": "JSON (.json)",
  "PDF (print)": "PDF (in)",
  Relay: "Relay",
  "On Cloudflare, click {b1}, then find {b2} and click {b3}.":
    "Trên Cloudflare, nhấp vào {b1}, sau đó tìm {b2} và nhấp vào {b3}.",
  "Create Token": "Tạo token",
  "Create Custom Token": "Tạo token tùy chỉnh",
  "Get started": "Bắt đầu",
  "Cloudflare token form filled with name 'Harbor Relay' and one permission row set to Account / Workers Scripts / Edit":
    "Biểu mẫu token Cloudflare được điền tên 'Harbor Relay' và một hàng quyền được đặt thành Account / Workers Scripts / Edit",
  "Token name can be anything. The permission row must be exactly {b1} + {b2} + {b3}.":
    "Tên token có thể là bất kỳ tên nào. Hàng quyền phải chính xác là {b1} + {b2} + {b3}.",
  "Workers Scripts": "Workers Scripts",
  "Leave everything below it alone. Scroll down, click {b1}, then {b2}. Copy the long string it shows you (you only see it once) and bring it back here.":
    "Giữ nguyên mọi mục bên dưới. Cuộn xuống, nhấp vào {b1}, rồi {b2}. Sao chép chuỗi dài hiển thị ở đó (bạn chỉ thấy chuỗi này một lần) và quay lại đây.",
  "Continue to summary": "Tiếp tục đến phần tóm tắt",
  Continue: "Tiếp tục",
  "Something went wrong.": "Đã xảy ra lỗi.",
  "Your account hasn't picked its free {code} address yet. Cloudflare only asks the first time. Quick to set up.":
    "Tài khoản của bạn chưa chọn địa chỉ {code} miễn phí. Cloudflare chỉ hỏi trong lần đầu tiên. Thiết lập rất nhanh.",
  "Click {b1} in the top right. Pick the {b2} template (it's the default, should already be selected).":
    "Nhấp vào {b1} ở góc trên bên phải. Chọn mẫu {b2} (đây là mẫu mặc định và thường đã được chọn).",
  Create: "Tạo",
  "Hello World": "Hello World",
  "Cloudflare asks you to pick a name (this becomes {code}). Type any name (your first name works). Then click {b1}.":
    "Cloudflare yêu cầu bạn chọn một tên (tên này sẽ trở thành {code}). Nhập tên bất kỳ (có thể dùng tên của bạn). Sau đó nhấp vào {b1}.",
  Deploy: "Triển khai",
  "Come back here and hit {b1}. The Hello World can stay where it is. It's free and harmless.":
    "Quay lại đây và nhấn {b1}. Có thể giữ nguyên Hello World. Mục này miễn phí và không gây ảnh hưởng.",
  "Reset all ({count})": "Đặt lại tất cả ({count})",
  Player: "Trình phát",
  "Inside the playback view.": "Trong giao diện phát.",
  Other: "Khác",
  Navigation: "Điều hướng",
  Seeking: "Tua",
  Volume: "Âm lượng",
  Tracks: "Rãnh",
  Speed: "Tốc độ",
  Panels: "Bảng điều khiển",
  "Close player": "Đóng trình phát",
  "Exit playback and return to the previous view.": "Thoát phát và quay lại giao diện trước.",
  "Play / pause": "Phát / tạm dừng",
  "Toggle playback.": "Chuyển đổi giữa phát và tạm dừng.",
  "Toggle fullscreen": "Bật/tắt toàn màn hình",
  "Enter or exit fullscreen.": "Vào hoặc thoát chế độ toàn màn hình.",
  "Toggle stats overlay": "Bật/tắt lớp phủ thống kê",
  "Show or hide the playback stats overlay.": "Hiện hoặc ẩn lớp phủ thống kê phát.",
  "Cycle aspect / crop": "Chuyển tỷ lệ / cắt khung hình",
  "Cycle aspect and crop modes: Fit, Fill, Zoom, 16:9, 4:3, Original.":
    "Chuyển qua các chế độ tỷ lệ và cắt khung hình: Vừa khung, Lấp đầy, Thu phóng, 16:9, 4:3, Gốc.",
  "Zoom out": "Thu nhỏ",
  "Step zoom out to restore baked-in black bars (Zoom mode).":
    "Thu nhỏ từng mức để khôi phục các dải đen có sẵn trong video (chế độ Thu phóng).",
  "Zoom in": "Phóng to",
  "Step zoom in to crop baked-in black bars (Zoom mode).":
    "Phóng to từng mức để cắt các dải đen có sẵn trong video (chế độ Thu phóng).",
  Screenshot: "Chụp màn hình",
  "Save the current frame (video only, no subtitles) as a PNG to Pictures/Harbor.":
    "Lưu khung hình hiện tại (chỉ video, không có phụ đề) dưới dạng PNG vào Pictures/Harbor.",
  "Record GIF": "Quay GIF",
  "Start or stop recording a GIF of the video (no subtitles). Saves to Pictures/Harbor.":
    "Bắt đầu hoặc dừng quay GIF từ video (không có phụ đề). Lưu vào Pictures/Harbor.",
  "Jump back by the Back seek step set under Behavior.":
    "Lùi theo khoảng tua lùi được đặt trong Hành vi.",
  "Jump forward by the Forward seek step set under Behavior.":
    "Tiến theo khoảng tua tới được đặt trong Hành vi.",
  "Seek back 30s": "Tua lùi 30 giây",
  "Jump back thirty seconds.": "Lùi ba mươi giây.",
  "Seek forward 30s": "Tua tới 30 giây",
  "Jump forward thirty seconds.": "Tiến ba mươi giây.",
  "Jump to start": "Chuyển về đầu",
  "Seek to the beginning.": "Tua về đầu.",
  "Jump to end": "Chuyển đến cuối",
  "Seek to the last half second.": "Tua đến nửa giây cuối.",
  "Raise volume (hold Shift for big steps).": "Tăng âm lượng (giữ Shift để tăng theo mức lớn).",
  "Lower volume (hold Shift for big steps).": "Giảm âm lượng (giữ Shift để giảm theo mức lớn).",
  "Toggle mute": "Bật/tắt tiếng",
  "Mute or unmute audio.": "Tắt hoặc bật lại âm thanh.",
  "Cycle subtitles": "Chuyển phụ đề",
  "Cycle through available subtitle tracks.": "Chuyển qua các bản phụ đề có sẵn.",
  "Cycle subtitles (alt)": "Chuyển phụ đề (phím thay thế)",
  "A second binding for the same action so muscle memory survives.":
    "Một phím tắt thứ hai cho cùng thao tác để giữ thói quen thao tác.",
  "Subtitle delay −0.1s": "Độ trễ phụ đề −0.1 giây",
  "Shift subtitle timing earlier (Shift for fine steps).":
    "Điều chỉnh phụ đề xuất hiện sớm hơn (giữ Shift để chỉnh theo mức nhỏ).",
  "Subtitle delay +0.1s": "Độ trễ phụ đề +0.1 giây",
  "Shift subtitle timing later (Shift for fine steps).":
    "Điều chỉnh phụ đề xuất hiện muộn hơn (giữ Shift để chỉnh theo mức nhỏ).",
  "Skip to the next episode if available.": "Chuyển đến tập tiếp theo nếu có.",
  "Skip to the previous episode if available.": "Chuyển đến tập trước nếu có.",
  "Previous channel": "Kênh trước",
  "Jump back to the last live channel you watched (live TV only).":
    "Quay lại kênh trực tiếp gần nhất đã xem (chỉ TV trực tiếp).",
  "Speed down": "Giảm tốc độ",
  "Slow playback by 0.25x.": "Giảm tốc độ phát 0.25x.",
  "Speed up": "Tăng tốc độ",
  "Speed playback up by 0.25x.": "Tăng tốc độ phát 0.25x.",
  "Stream switcher": "Trình chuyển luồng",
  "Open or close the in-player stream switcher.":
    "Mở hoặc đóng trình chuyển luồng trong trình phát.",
  "Up next / episodes": "Tiếp theo / các tập",
  "Open or close the episode panel.": "Mở hoặc đóng bảng tập phim.",
  "TV guide": "Lịch phát sóng TV",
  "Open or close the live TV guide (live channels only).":
    "Mở hoặc đóng lịch phát sóng TV trực tiếp (chỉ kênh trực tiếp).",
  "DVR / record": "DVR / ghi hình",
  "Open or close the live TV recorder (live channels only).":
    "Mở hoặc đóng trình ghi TV trực tiếp (chỉ kênh trực tiếp).",
  "Sleep at end of episode": "Hẹn giờ ngủ khi hết tập",
  "Toggle a sleep timer that pauses when this episode ends.":
    "Bật/tắt hẹn giờ ngủ để tạm dừng khi tập này kết thúc.",
  Low: "Thấp",
  "cosmetic, minor": "thẩm mỹ, nhỏ",
  annoying: "gây khó chịu",
  High: "Cao",
  "feature broken": "tính năng bị lỗi",
  Critical: "Nghiêm trọng",
  "app unusable": "không thể sử dụng ứng dụng",
  "Drop a clip of the bug if you can. A 5-second screen recording usually says more than five paragraphs.":
    "Nếu có thể, hãy gửi đoạn video về lỗi. Một bản ghi màn hình 5 giây thường rõ ràng hơn năm đoạn văn.",
  "Drop screenshots or screen recordings, or click to browse":
    "Thả ảnh chụp hoặc bản ghi màn hình vào đây, hoặc nhấp để duyệt",
  "PNG, JPG, WebP, GIF, MP4, WebM, MOV. Up to 6 files, 100 MB each.":
    "PNG, JPG, WebP, GIF, MP4, WebM, MOV. Tối đa 6 tệp, mỗi tệp 100 MB.",
  "Credit me in the release notes if this report leads to a fix.":
    "Ghi tên tôi trong ghi chú phát hành nếu báo cáo này giúp khắc phục lỗi.",
  "Want to fix it yourself?": "Bạn muốn tự sửa lỗi?",
  "Harbor is open source. PRs that reference a bug get reviewed within 48h and ship with credit in the release notes.":
    "Harbor là mã nguồn mở. PR có dẫn chiếu đến lỗi sẽ được xem xét trong vòng 48 giờ và được ghi tên trong ghi chú phát hành khi ra mắt.",
  "Open repo on GitHub": "Mở kho mã trên GitHub",
  "Browse pull requests": "Duyệt các pull request",
  "What gets sent": "Dữ liệu được gửi",
  "Could not send:": "Không thể gửi:",
  "Ready to send": "Sẵn sàng gửi",
  "Player freezes after the second episode autoplays":
    "Trình phát bị treo sau khi tự động phát tập thứ hai",
  "Stream should start playing within a few seconds.": "Luồng phát sẽ bắt đầu trong vài giây.",
  "Spinner stays forever and nothing in the player loads.":
    "Biểu tượng tải cứ quay mãi và trình phát không tải nội dung nào.",
  "Email or Discord": "Email hoặc Discord",
  "Loading environment details…": "Đang tải thông tin môi trường…",
  "Auto-included. No keys, no library, no URLs. Just structural flags so reproductions go faster.":
    "Tự động đính kèm. Không có khóa, thư viện hay URL. Chỉ có các cờ cấu trúc để tái hiện lỗi nhanh hơn.",
  "Harbor test message (Discord). If you can read this, your webhook is wired up.":
    "Tin nhắn thử nghiệm Harbor (Discord). Nếu đọc được tin nhắn này, webhook của bạn đã được kết nối.",
  "Harbor test message (Telegram). If you can read this, your webhook is wired up.":
    "Tin nhắn thử nghiệm Harbor (Telegram). Nếu đọc được tin nhắn này, webhook của bạn đã được kết nối.",
  Failed: "Thất bại",
  Types: "Thể loại",
  Movies: "Phim điện ảnh",
  TV: "Truyền hình",
  Anime: "Anime",
  "Right-click a text channel, pick": "Nhấp chuột phải vào một kênh văn bản, chọn",
  Click: "Nhấp vào",
  "on the left, then": "ở bên trái, rồi",
  "name it Harbor, hit": "đặt tên là Harbor, nhấn",
  "Telegram sends through a bot you create. You need two things: a":
    "Telegram gửi qua bot do bạn tạo. Bạn cần hai thứ: một",
  "and your": "và",
  "Both go in the boxes above. Harbor builds the URL for you.":
    "Nhập cả hai vào các ô bên trên. Harbor sẽ tạo URL cho bạn.",
  Tap: "Nhấn vào",
  "below. In Telegram, send him": "bên dưới. Trong Telegram, gửi cho bot đó",
  "Pick any name. Pick a username ending in": "Chọn tên bất kỳ. Chọn tên người dùng kết thúc bằng",
  "BotFather replies with a token like": "BotFather sẽ trả lời bằng một token như",
  "Long string with a colon in it. Copy it. Paste it into the":
    "Một chuỗi dài có dấu hai chấm. Sao chép chuỗi đó. Dán vào ô",
  "box above.": "bên trên.",
  "below. Send it": "bên dưới. Gửi cho bot",
  "It replies with your numeric ID. Copy that number. Paste it into the":
    "Bot sẽ trả lời bằng ID dạng số của bạn. Sao chép số đó. Dán vào ô",
  Hit: "Nhấn",
  "You should get a message from your new bot.": "Bạn sẽ nhận được tin nhắn từ bot mới.",
  "A new movie comes out": "Có phim điện ảnh mới ra mắt",
  "A new series comes out": "Có phim bộ mới ra mắt",
  "A new anime comes out": "Có anime mới ra mắt",
  "Someone I track has a new release": "Người tôi theo dõi có tác phẩm mới",
  "A specific genre releases": "Có tác phẩm mới thuộc một thể loại cụ thể",
  "A streamer releases something": "Một dịch vụ phát trực tuyến ra mắt nội dung mới",
  "A country releases something": "Có tác phẩm mới từ một quốc gia",
  "Trakt anticipated picks up something":
    "Có nội dung mới xuất hiện trong danh sách được mong đợi trên Trakt",
  "My Trakt watchlist updates": "Danh sách xem Trakt của tôi được cập nhật",
  "A Live TV program is about to start": "Một chương trình TV trực tiếp sắp bắt đầu",
  "Any new movie": "Bất kỳ phim điện ảnh mới nào",
  "Any new series": "Bất kỳ phim bộ mới nào",
  "Any new anime": "Bất kỳ anime mới nào",
  "Any of your {n} tracked people": "Bất kỳ ai trong số {n} người bạn theo dõi",
  "Tracked people": "Người đang theo dõi",
  "Any genre": "Bất kỳ thể loại nào",
  "Any streamer": "Bất kỳ dịch vụ phát trực tuyến nào",
  "Any country": "Bất kỳ quốc gia nào",
  "Trakt anticipated": "Được mong đợi trên Trakt",
  "Your Trakt watchlist": "Danh sách xem Trakt của bạn",
  "Live TV": "TV trực tiếp",
  favorites: "yêu thích",
  "all channels": "tất cả kênh",
  "{n} min lead": "trước {n} phút",
  Automations: "Tự động hóa",
  "no channel": "không có kênh",
  "Edit rule": "Sửa quy tắc",
  WHEN: "KHI",
  "Media type": "Loại nội dung",
  Genres: "Thể loại",
  Streamers: "Dịch vụ phát trực tuyến",
  Countries: "Quốc gia",
  "Only my favorited channels": "Chỉ các kênh yêu thích của tôi",
  "Heads up": "Lưu ý",
  "Harbor scans your IPTV playlists' EPG every 30 min for programs about to start.":
    "Harbor quét EPG trong danh sách phát IPTV của bạn mỗi 30 phút để tìm các chương trình sắp bắt đầu.",
  "Add people in the Custom calendar manager first, then come back here.":
    "Trước tiên, hãy thêm người trong trình quản lý lịch Tùy chỉnh, sau đó quay lại đây.",
  "People (empty = all tracked)": "Người (để trống = tất cả người đang theo dõi)",
  "THEN notify on": "THÌ thông báo trên",
  "Save rule": "Lưu quy tắc",
  "My library": "Thư viện của tôi",
  Anticipated: "Được mong đợi",
  "Custom calendar": "Lịch tùy chỉnh",
  "Harbor checks harbor.site for new versions and installs them in place. Nothing installs until you choose to, and a dismissed update never nags you again.":
    "Harbor kiểm tra phiên bản mới trên harbor.site và cài đặt trực tiếp. Không có gì được cài đặt cho đến khi bạn chọn, và bản cập nhật đã bỏ qua sẽ không nhắc lại.",
  "Library, watch progress, and addon collection sync from this account.":
    "Thư viện, tiến độ xem và bộ sưu tập tiện ích bổ sung được đồng bộ từ tài khoản này.",
  "Export your entire Harbor setup to a single file, then restore it on a new computer or keep it as a backup. Everything is included except your Stremio sign-in.":
    "Xuất toàn bộ thiết lập Harbor ra một tệp duy nhất, sau đó khôi phục trên máy tính mới hoặc giữ làm bản sao lưu. Mọi thứ đều được bao gồm, ngoại trừ thông tin đăng nhập Stremio của bạn.",
  "Harbor sends no telemetry. This also drops outbound ad, analytics, and tracker requests that addons or metadata providers try to make, before they leave your machine.":
    "Harbor không gửi dữ liệu đo từ xa. Tính năng này cũng chặn các yêu cầu quảng cáo, phân tích và theo dõi gửi đi mà tiện ích bổ sung hoặc nhà cung cấp siêu dữ liệu cố thực hiện, trước khi chúng rời khỏi máy của bạn.",
  "Keep Harbor a click away. Close it to the system tray instead of quitting, and control it from the tray menu. These also mirror into the tray menu live.":
    "Luôn dễ dàng truy cập Harbor. Đóng ứng dụng xuống khay hệ thống thay vì thoát và điều khiển ứng dụng từ menu khay. Các tùy chọn này cũng được cập nhật tức thì trong menu khay.",
  "Your color": "Màu của bạn",
  "Used for your cursor in Watch Together, your draw color, and your name pill in chat.":
    "Dùng cho con trỏ của bạn trong Xem cùng nhau, màu vẽ và thẻ tên trong cuộc trò chuyện.",
  "Harbor catches stremio:// install links so the configure-and-install flow stays inside the app. Every install also syncs to your Stremio account, so the official app remains the canonical home for your library.":
    "Harbor tiếp nhận các liên kết cài đặt stremio:// để quy trình cấu hình và cài đặt luôn diễn ra trong ứng dụng. Mỗi lượt cài đặt cũng được đồng bộ với tài khoản Stremio của bạn, vì vậy ứng dụng chính thức vẫn là nơi quản lý chuẩn cho thư viện của bạn.",
  "Let your Discord friends see what you are watching, with the show poster and a live progress bar. Desktop only, and only your own Discord client is involved (nothing touches a Harbor server).":
    "Cho phép bạn bè trên Discord biết bạn đang xem gì, kèm áp phích phim và thanh tiến độ trực tiếp. Chỉ dành cho máy tính và chỉ liên quan đến ứng dụng Discord của bạn (không có dữ liệu nào đi qua máy chủ Harbor).",
  "Saved {d} from Harbor {a}.": "Đã lưu {d} từ Harbor {a}.",
  "MPV (native, recommended)": "MPV (gốc, khuyên dùng)",
  "HTML5 (browser-based)": "HTML5 (dựa trên trình duyệt)",
  "Player shell": "Giao diện trình phát",
  "Seek bar style": "Kiểu thanh tua",
  "Subtitle font size": "Cỡ chữ phụ đề",
  "Subtitle background": "Nền phụ đề",
  "Play mode": "Chế độ phát",
  "Auto next episode": "Tự động phát tập tiếp theo",
  "Automatically play the next episode when the current one ends.":
    "Tự động phát tập tiếp theo khi tập hiện tại kết thúc.",
  "Local engine address": "Địa chỉ bộ máy cục bộ",
  "Remote server": "Máy chủ từ xa",
  "Custom MPV code": "Mã MPV tùy chỉnh",
  "Anime4K shaders": "Shader Anime4K",
  "Server address": "Địa chỉ máy chủ",
  Connection: "Kết nối",
  "Downloading to": "Đang tải xuống vào",
  "Downloads folder": "Thư mục tải xuống",
  "Speed test": "Kiểm tra tốc độ",
  "Run speed test": "Chạy kiểm tra tốc độ",
  Test: "Kiểm tra",
  Internals: "Nội bộ",
  Layouts: "Bố cục",
  "New layout": "Bố cục mới",
  "Save layout": "Lưu bố cục",
  "Delete layout": "Xóa bố cục",
  "Layout name": "Tên bố cục",
  "Upload icon": "Tải biểu tượng lên",
  "Add element": "Thêm thành phần",
  "Top bar": "Thanh trên",
  "Bottom bar": "Thanh dưới",
  Inspector: "Trình kiểm tra",
  Options: "Tùy chọn",
  Controls: "Điều khiển",
  "Reset layout": "Đặt lại bố cục",
  "Deploy relay": "Triển khai relay",
  "Relay URL": "URL relay",
  "Test relay": "Kiểm tra relay",
  "Relay status": "Trạng thái relay",
  "Relay docs": "Tài liệu relay",
  "Your relay": "Relay của bạn",
  "Relay panel": "Bảng relay",
  "Set up a Cloudflare relay for Watch Together": "Thiết lập relay Cloudflare cho Xem cùng nhau",
  "Copy relay URL": "Sao chép URL relay",
  "Relay is up to date": "Relay đã được cập nhật",
  "Relay needs update": "Relay cần cập nhật",
  "Relay not reachable": "Không thể kết nối với relay",
  "Checking…": "Đang kiểm tra…",
  "Check relay": "Kiểm tra relay",
  "Relay test passed": "Kiểm tra relay thành công",
  "Scans your Stremio library and rewrites any item whose shape doesn't match Stremio's exact schema. Safe to run anytime; only items that need fixing get touched.":
    "Quét thư viện Stremio và ghi lại mọi mục có cấu trúc không khớp chính xác với lược đồ của Stremio. Có thể chạy an toàn bất cứ lúc nào; chỉ các mục cần sửa mới bị thay đổi.",
  "Translate series and movie posters to Arabic if available on TMDB":
    "Chuyển áp phích phim bộ và phim sang tiếng Ả Rập nếu có trên TMDB",
  "If enabled, posters will display the Arabic title. Disable this to keep the original English poster.":
    "Khi bật, áp phích sẽ hiển thị tiêu đề tiếng Ả Rập. Tắt tùy chọn này để giữ áp phích tiếng Anh gốc.",
  "Translate descriptions and synopsis to Arabic":
    "Dịch mô tả và nội dung tóm tắt sang tiếng Ả Rập",
  "Enable this to fetch Arabic descriptions for series and movies when available on TMDB.":
    "Bật tùy chọn này để lấy mô tả tiếng Ả Rập cho phim bộ và phim khi có trên TMDB.",
  "Summary needs at least 6 characters": "Nội dung tóm tắt phải có ít nhất 6 ký tự",
  "Preparing…": "Đang chuẩn bị…",
  "Sending…": "Đang gửi…",
  "Submit bug report": "Gửi báo cáo lỗi",
  "Move to previous slot": "Chuyển sang vị trí trước",
  "Move to next slot": "Chuyển sang vị trí tiếp theo",
  "Preview state": "Trạng thái xem trước",
  "Show this control": "Hiện nút điều khiển này",
  "Hide this control": "Ẩn nút điều khiển này",
  "Slot is getting crowded ({n}/{limit}). May overflow on narrow screens.":
    "Vị trí sắp quá tải ({n}/{limit}). Có thể bị tràn trên màn hình hẹp.",
  "Series tab": "Thẻ phim bộ",
  "Watch Together panel": "Bảng Xem cùng nhau",
  "Show this panel": "Hiện bảng này",
  "Hide this panel": "Ẩn bảng này",
  "Manual picker": "Chọn thủ công",
  "Hitting Play jumps straight into playback with the best stream Harbor finds.":
    "Nhấn Phát để phát ngay luồng tốt nhất mà Harbor tìm thấy.",
  "Hitting Play opens the source list so you can choose quality, debrid, and audio yourself.":
    "Nhấn Phát để mở danh sách nguồn, cho phép bạn tự chọn chất lượng, debrid và âm thanh.",
  "Remember last stream": "Ghi nhớ luồng gần nhất",
  "Auto-skip stalled streams": "Tự động bỏ qua luồng bị treo",
  "If a stream hasn't started playing within 10 seconds (a dead source or an addon that's down), automatically try the next available stream. Off by default.":
    "Nếu luồng chưa bắt đầu phát trong vòng 10 giây (nguồn hỏng hoặc tiện ích bổ sung ngừng hoạt động), tự động thử luồng khả dụng tiếp theo. Mặc định tắt.",
  "When you resume something you were watching, replay the exact stream you last used (same addon and source) instead of opening the picker again. Turn off to always choose fresh.":
    "Khi tiếp tục nội dung đang xem dở, phát lại đúng luồng đã dùng gần nhất (cùng tiện ích bổ sung và nguồn) thay vì mở lại trình chọn. Tắt để luôn chọn nguồn mới.",
  "mpv on the desktop app, HTML5 in the browser. The right engine without thinking about it.":
    "mpv trên ứng dụng máy tính, HTML5 trong trình duyệt. Tự động dùng công cụ phát phù hợp.",
  "Native webview playback. Smooth and integrated, but limited codec coverage.":
    "Phát bằng webview gốc. Mượt mà và tích hợp tốt, nhưng hỗ trợ codec còn hạn chế.",
  "Bundled with Harbor. Plays anything you throw at it.": "Đi kèm Harbor. Phát được mọi nội dung.",
  "Embed mpv inside Harbor window": "Nhúng mpv vào cửa sổ Harbor",
  "Renders mpv inline so playback lives in Harbor itself. Disable to open it in a separate window instead.":
    "Hiển thị mpv ngay trong Harbor để phát trực tiếp trong ứng dụng. Tắt để mở trong cửa sổ riêng.",
  "HDR-to-SDR tonemapping": "Ánh xạ tông màu HDR sang SDR",
  "Maps HDR sources to SDR using bt.2446a. Recommended on SDR displays.":
    "Ánh xạ nguồn HDR sang SDR bằng bt.2446a. Khuyên dùng trên màn hình SDR.",
  "HDR in a separate window": "HDR trong cửa sổ riêng",
  "Plays HDR content in its own window so Windows treats it as true HDR (the SDR brightness slider stops dimming it). Turn off HDR-to-SDR tonemapping above to use this on an HDR display.":
    "Phát nội dung HDR trong cửa sổ riêng để Windows nhận diện là HDR thực (thanh trượt độ sáng SDR sẽ không còn làm tối nội dung). Tắt Ánh xạ tông màu HDR sang SDR ở trên để dùng tính năng này trên màn hình HDR.",
  "HDR display mode": "Chế độ hiển thị HDR",
  "Keeps Harbor embedded but lifts the HDR video onto its own opaque plane with the controls floating above, so Windows shows true HDR without the brightness slider dimming it. Needs HDR-to-SDR tonemapping off.":
    "Vẫn nhúng Harbor nhưng đưa video HDR lên một lớp hiển thị riêng, không trong suốt, với các nút điều khiển nổi phía trên, để Windows hiển thị HDR thực mà không bị thanh trượt độ sáng làm tối. Cần tắt Ánh xạ tông màu HDR sang SDR.",
  "Line-free video mode": "Chế độ video không viền sáng",
  "Forces a compatibility present mode that removes a thin bright line some monitors show at the screen edge. Side effects: 4K playback can drop to a slideshow and HDR content looks dimmer (this mode bypasses the HDR display path). Leave OFF unless you see that line. Restart playback to apply.":
    "Buộc dùng chế độ hiển thị tương thích để loại bỏ đường sáng mảnh mà một số màn hình hiển thị ở mép. Tác dụng phụ: phát 4K có thể giật như trình chiếu và nội dung HDR trông tối hơn (chế độ này bỏ qua đường dẫn hiển thị HDR). Chỉ BẬT nếu bạn thấy đường sáng đó. Khởi động lại quá trình phát để áp dụng.",
  "Motion smoothing": "Làm mượt chuyển động",
  "Interpolates frames for smoother panning, best on anime. Needs a display refresh rate above the video's frame rate, and can stutter on weak GPUs. mpv only.":
    "Nội suy khung hình để chuyển cảnh mượt hơn, phù hợp nhất với anime. Cần màn hình có tần số quét cao hơn tốc độ khung hình của video và có thể bị giật trên GPU yếu. Chỉ dành cho mpv.",
  "Direct torrent streaming": "Phát torrent trực tiếp",
  "When you have no debrid set up, or a torrent isn't cached, stream it straight from the bundled engine on localhost:11470. This connects to peers over your own connection, the same way Stremio's built-in streaming does.":
    "Khi chưa thiết lập debrid hoặc torrent chưa được lưu đệm, phát trực tiếp bằng công cụ đi kèm tại localhost:11470. Tính năng này kết nối với các peer qua kết nối mạng của bạn, tương tự tính năng phát tích hợp của Stremio.",
  "Use Harbor's built-in engine (beta)": "Dùng công cụ tích hợp của Harbor (beta)",
  "Stream torrents through Harbor's own Rust peer-to-peer engine instead of the bundled Stremio Server. Falls back automatically if it can't connect. Status and a self-test live in the Local engine card below.":
    "Phát torrent qua công cụ peer-to-peer Rust riêng của Harbor thay vì Stremio Server đi kèm. Tự động chuyển sang phương án dự phòng nếu không thể kết nối. Trạng thái và tính năng tự kiểm tra nằm trong thẻ Công cụ cục bộ bên dưới.",
  "Always re-encode when casting (recommended)": "Luôn mã hóa lại khi truyền (khuyên dùng)",
  "On by default. Pipes every cast through ffmpeg as H.264 + AAC + MPEG-TS so Samsung, LG, Sony, and other DLNA TVs accept the stream regardless of source codec. Turn off only if you have a beefy receiver that handles raw HEVC/DTS and want max quality. Requires ffmpeg in PATH.":
    "Mặc định bật. Chuyển mọi nội dung truyền qua ffmpeg thành H.264 + AAC + MPEG-TS để TV DLNA của Samsung, LG, Sony và các hãng khác nhận luồng bất kể codec nguồn. Chỉ tắt nếu thiết bị nhận mạnh, xử lý được HEVC/DTS thô và bạn muốn chất lượng tối đa. Yêu cầu ffmpeg trong PATH.",
  "Sharper lines and cleaner gradients on anime, in real time. One-tap setup below.":
    "Làm sắc nét đường nét và mượt dải màu anime theo thời gian thực. Thiết lập bằng một lần nhấn bên dưới.",
  "Disabled while strict remote streaming is on": "Bị tắt khi bật chế độ phát từ xa nghiêm ngặt",
  "Custom location": "Vị trí tùy chỉnh",
  "System default": "Mặc định hệ thống",
  "Choose folder": "Chọn thư mục",
  "Drop shadow": "Bóng đổ",
  "Soft halo around the text. Cleanest on most content.":
    "Quầng sáng nhẹ quanh chữ. Rõ nét nhất với hầu hết nội dung.",
  "Hard stroke around each letter. High contrast.": "Viền đậm quanh từng chữ. Độ tương phản cao.",
  "Black bar": "Nền đen",
  "Rounded background panel behind the text. Most readable.":
    "Nền bo góc phía sau chữ. Dễ đọc nhất.",
  "Keep original": "Giữ nguyên bản",
  "Styled (ASS) subs keep their own fonts, colors, and effects. Truest to the release.":
    "Phụ đề có định dạng (ASS) giữ nguyên phông chữ, màu sắc và hiệu ứng. Sát với bản phát hành nhất.",
  "Resize only": "Chỉ đổi kích thước",
  "Keep the original look but apply your size and position.":
    "Giữ giao diện gốc nhưng áp dụng kích thước và vị trí bạn chọn.",
  "Use my style": "Dùng kiểu của tôi",
  "Force your font, size, and color onto styled subs. Use this for Arabic or any subs showing boxes. Can affect karaoke and signs.":
    "Buộc phụ đề có định dạng dùng phông chữ, kích thước và màu bạn chọn. Dùng cho tiếng Ả Rập hoặc phụ đề hiển thị ô vuông. Có thể ảnh hưởng đến karaoke và chữ trên màn hình.",
  "Styled (ASS) subtitles": "Phụ đề có định dạng (ASS)",
  "Seeing empty boxes instead of letters? Choose Arabic under Font and switch to Use my style.":
    "Thấy ô trống thay vì chữ? Chọn Tiếng Ả Rập trong Phông chữ rồi chuyển sang Dùng kiểu của tôi.",
  "Background opacity": "Độ mờ nền",
  "Outline thickness": "Độ dày đường viền",
  "Bold text": "Chữ đậm",
  "Render subtitles in a heavier weight. Turn off to use your font's normal weight.":
    "Hiển thị phụ đề với nét chữ đậm hơn. Tắt để dùng độ đậm thông thường của phông chữ.",
  "Show subtitles in Picture-in-Picture": "Hiện phụ đề trong chế độ Hình trong hình",
  "Hide subtitles when the player shrinks into the floating PiP window.":
    "Ẩn phụ đề khi trình phát thu nhỏ thành cửa sổ PiP nổi.",
  "Distance from bottom": "Khoảng cách từ cạnh dưới",
  "Text color": "Màu chữ",
  "Outline color": "Màu viền chữ",
  "Box color": "Màu hộp",
  "Reset to defaults": "Đặt lại về mặc định",
  "{n} custom": "{n} tùy chỉnh",
  "Remove {name}": "Xóa {name}",
  "Upload font": "Tải phông chữ lên",
  "Delete this font?": "Xóa phông chữ này?",
  "will be removed from Harbor. Anything you've set to use it will fall back to Inter.":
    "sẽ bị xóa khỏi Harbor. Mọi nội dung đang dùng phông chữ này sẽ chuyển về Inter.",
  "Show thumbnail preview on hover": "Hiện hình thu nhỏ xem trước khi di chuột",
  "Generates a frame on the fly as you scrub the seek bar. Works on debrid streams and local files.":
    "Tạo khung hình tức thì khi bạn tua trên thanh tiến trình. Hoạt động với luồng debrid và tệp cục bộ.",
  "Bar style": "Kiểu thanh",
  "Solid fill, no texture. Cleanest baseline.": "Màu tô đặc, không họa tiết. Kiểu cơ bản gọn nhất.",
  "Subtle Apple-like sheen on the filled portion.": "Độ bóng nhẹ kiểu Apple trên phần đã tô.",
  "Diagonal stripes across the fill, retro vibe.":
    "Các sọc chéo trên phần tô, mang phong cách hoài cổ.",
  "Six horizontal stripes. Pairs with nyan cat dot.": "Sáu sọc ngang. Phù hợp với chấm mèo nyan.",
  "Image bar active. Pick a style above to switch back, or clear the image below.":
    "Thanh hình ảnh đang hoạt động. Chọn một kiểu ở trên để chuyển lại hoặc xóa hình ảnh bên dưới.",
  "Bar height": "Chiều cao thanh",
  "Bar color": "Màu thanh",
  "Default (gold accent)": "Mặc định (điểm nhấn màu vàng kim)",
  "Bar image": "Hình ảnh thanh",
  "Upload a pattern to tile across the bar": "Tải họa tiết lên để lặp trên thanh",
  "Tiles horizontally; the bar's height crops it vertically. Animated GIFs up to 2 MB play.":
    "Lặp theo chiều ngang; chiều cao của thanh sẽ cắt ảnh theo chiều dọc. GIF động tối đa 2 MB có thể phát.",
  "Seek dot shape": "Hình dạng nút tua",
  "The default round dot.": "Nút tròn mặc định.",
  "Rounded square in the same color.": "Hình vuông bo góc cùng màu.",
  "Custom image": "Hình ảnh tùy chỉnh",
  "PNG, GIF, WebP, or SVG. Animated GIFs play.": "PNG, GIF, WebP hoặc SVG. GIF động có thể phát.",
  "No dot, just the bar.": "Không có nút, chỉ có thanh.",
  "Image size": "Kích thước hình ảnh",
  "Dot size": "Kích thước nút",
  "Dot image": "Hình ảnh nút",
  "Upload nyan cat, a sticker, anything": "Tải mèo nyan, nhãn dán hoặc bất kỳ hình nào lên",
  "PNG, JPEG, WebP, or SVG (auto-shrunk if huge). Animated GIFs up to 2 MB play live.":
    "PNG, JPEG, WebP hoặc SVG (tự động thu nhỏ nếu quá lớn). GIF động tối đa 2 MB phát trực tiếp.",
  "Desktop only": "Chỉ dành cho máy tính",
  "Local engine": "Công cụ cục bộ",
  "Built-in peer-to-peer streaming, served from your own machine.":
    "Tích hợp sẵn tính năng phát trực tuyến ngang hàng từ chính máy của bạn.",
  "Active torrents": "Torrent đang hoạt động",
  "Run self-test": "Chạy tự kiểm tra",
  "Running self-test": "Đang tự kiểm tra",
  "Restart engine": "Khởi động lại công cụ",
  "Self-test is disabled while strict remote streaming is on. It downloads a test torrent over peer-to-peer on this machine.":
    "Tính năng tự kiểm tra bị tắt khi chế độ phát trực tuyến từ xa nghiêm ngặt đang bật. Tính năng này tải một torrent thử nghiệm qua mạng ngang hàng trên máy này.",
  "Self-test": "Tự kiểm tra",
  "Remote streaming server": "Máy chủ phát trực tuyến từ xa",
  "Point Harbor at a streaming server on another machine, like the Stremio service on a home server. Torrents download and stream from that machine instead of this one.":
    "Kết nối Harbor với máy chủ phát trực tuyến trên một máy khác, chẳng hạn như dịch vụ Stremio trên máy chủ tại nhà. Torrent sẽ được tải xuống và phát trực tuyến từ máy đó thay vì máy này.",
  "Use exclusively (never fall back to local)":
    "Chỉ sử dụng máy chủ này (không bao giờ chuyển về cục bộ)",
  "If the server is unreachable, playback fails instead of streaming locally. Use this when your VPN runs on the server machine and torrent traffic must never leave this one.":
    "Nếu không thể kết nối với máy chủ, việc phát sẽ thất bại thay vì phát trực tuyến cục bộ. Hãy dùng tùy chọn này khi VPN chạy trên máy chủ và lưu lượng torrent tuyệt đối không được đi qua máy này.",
  "Probes the server's settings endpoint from this device.":
    "Kiểm tra điểm cuối cài đặt của máy chủ từ thiết bị này.",
  "Run test": "Chạy kiểm tra",
  "Server reachable": "Có thể kết nối với máy chủ",
  "Test failed": "Kiểm tra thất bại",
  "The server answered with status {status}. Is that a streaming server?":
    "Máy chủ phản hồi với trạng thái {status}. Đây có phải là máy chủ phát trực tuyến không?",
  "Server reachable in {ms}ms. Harbor will use it for torrent streaming.":
    "Đã kết nối với máy chủ trong {ms}ms. Harbor sẽ dùng máy chủ này để phát trực tuyến torrent.",
  "Could not reach the server within 1.5 seconds. Check the address and that the server machine is online.":
    "Không thể kết nối với máy chủ trong vòng 1.5 giây. Hãy kiểm tra địa chỉ và đảm bảo máy chủ đang trực tuyến.",
  "No limit": "Không giới hạn",
  "Internet speed": "Tốc độ Internet",
  "Pick the cap your link can sustain. Run a real speed test if you need a number.":
    "Chọn giới hạn mà đường truyền có thể duy trì. Hãy đo tốc độ thực tế nếu bạn cần con số cụ thể.",
  "No filter. All bitrates considered equally.":
    "Không lọc. Mọi bitrate đều được đánh giá như nhau.",
  "Streams over {cap} Mbps will rank lower, even when cached.":
    "Các luồng trên {cap} Mbps sẽ xếp hạng thấp hơn, kể cả khi đã được lưu vào bộ nhớ đệm.",
  "Harbor curated": "Do Harbor tuyển chọn",
  "Hero carousel, Top 10, Trending, In Theaters, per-service rails. Addon catalogs append underneath, deduped.":
    "Băng chuyền nổi bật, Top 10, Thịnh hành, Đang chiếu rạp và các hàng theo từng dịch vụ. Danh mục của tiện ích bổ sung được thêm bên dưới và loại bỏ mục trùng lặp.",
  "Classic Stremio": "Stremio cổ điển",
  "Continue Watching, then your installed addons. Every catalog renders as its own row, install order, no dedup, no hero.":
    "Xem tiếp, sau đó là các tiện ích bổ sung đã cài đặt. Mỗi danh mục hiển thị thành một hàng riêng theo thứ tự cài đặt, không loại bỏ mục trùng lặp và không có mục nổi bật.",
  "Watchlist shows only saved titles": "Danh sách xem chỉ hiển thị các tựa phim đã lưu",
  "Advance Continue Watching to the next episode": "Chuyển mục Xem tiếp sang tập tiếp theo",
  "Keep frames for": "Lưu khung hình trong",
  "1 week": "1 tuần",
  "30 days": "30 ngày",
  "3 months": "3 tháng",
  "6 months": "6 tháng",
  "1 year": "1 năm",
  "Clear all saved frames": "Xóa tất cả khung hình đã lưu",
  "{n} frame stored. Wiping rebuilds them next time you watch.":
    "Đã lưu {n} khung hình. Sau khi xóa, khung hình sẽ được tạo lại vào lần xem tiếp theo.",
  "{n} frames stored. Wiping rebuilds them next time you watch.":
    "Đã lưu {n} khung hình. Sau khi xóa, các khung hình sẽ được tạo lại vào lần xem tiếp theo.",
  "No frames stored yet. They'll appear here as you watch things.":
    "Chưa lưu khung hình nào. Các khung hình sẽ xuất hiện ở đây khi bạn xem nội dung.",
  "Confirm clear": "Xác nhận xóa",
  "Clear all": "Xóa tất cả",
  "Fresh tomato for 60%+, splat for under.":
    "Cà chua tươi cho điểm từ 60% trở lên, cà chua dập cho điểm thấp hơn.",
  "RPDB key above, https://btttr.cc, or a {imdbId} template":
    "Khóa RPDB ở trên, https://btttr.cc hoặc mẫu {imdbId}",
  "Add a TMDB key above to unlock this.": "Thêm khóa TMDB ở trên để mở khóa tính năng này.",
  "Add an OMDb key above to unlock this.": "Thêm khóa OMDb ở trên để mở khóa tính năng này.",
  "Floats over the artwork": "Nổi trên ảnh minh họa",
  "Sits above the title strip": "Nằm phía trên dải tiêu đề",
  "Title text": "Chữ tiêu đề",
  "Resize the row titles on Home and the title shown in the player, without scaling the rest of the interface. You can also lead the player title with the series name instead of the episode.":
    "Đổi kích thước tiêu đề hàng trên Trang chủ và tiêu đề hiển thị trong trình phát mà không làm thay đổi tỷ lệ phần còn lại của giao diện. Bạn cũng có thể đặt tên phim bộ trước tên tập trong tiêu đề trình phát.",
  "Row titles": "Tiêu đề hàng",
  "Player title": "Tiêu đề trình phát",
  "Show series name first in the player": "Hiển thị tên phim bộ trước trong trình phát",
  "Lead with the show name instead of the episode title at the top of the player.":
    "Đặt tên phim bộ trước tên tập ở đầu trình phát.",
  "Block ads & trackers": "Chặn quảng cáo và trình theo dõi",
  "{n} tracker request blocked this session. Harbor itself sends zero telemetry.":
    "Đã chặn {n} yêu cầu theo dõi trong phiên này. Bản thân Harbor không gửi dữ liệu đo từ xa.",
  "{n} tracker requests blocked this session. Harbor itself sends zero telemetry.":
    "Đã chặn {n} yêu cầu theo dõi trong phiên này. Bản thân Harbor không gửi dữ liệu đo từ xa.",
  "Watching for ad, analytics, and tracking requests. Harbor itself sends zero telemetry.":
    "Đang giám sát các yêu cầu quảng cáo, phân tích và theo dõi. Bản thân Harbor không gửi dữ liệu đo từ xa.",
  "Ad, analytics, and tracking requests pass through untouched.":
    "Các yêu cầu quảng cáo, phân tích và theo dõi được truyền qua mà không bị can thiệp.",
  "Close to the system tray": "Thu nhỏ vào khay hệ thống khi đóng",
  "Closing the window tucks Harbor into the tray instead of quitting, so it reopens instantly. Right-click the tray icon for quick controls, or pick Quit to exit fully.":
    "Khi đóng cửa sổ, Harbor sẽ thu gọn vào khay thay vì thoát để có thể mở lại ngay. Nhấp chuột phải vào biểu tượng khay để dùng các điều khiển nhanh hoặc chọn Thoát để thoát hoàn toàn.",
  "Always on top": "Luôn ở trên cùng",
  "Keep the Harbor window above other windows.": "Giữ cửa sổ Harbor nằm trên các cửa sổ khác.",
  "Pause when minimized": "Tạm dừng khi thu nhỏ",
  "Stop playback when you minimize Harbor or send it to the tray.":
    "Dừng phát khi bạn thu nhỏ Harbor hoặc đưa ứng dụng vào khay.",
  "Pause when unfocused": "Tạm dừng khi mất tiêu điểm",
  "Stop playback whenever another window takes focus.":
    "Dừng phát mỗi khi cửa sổ khác nhận tiêu điểm.",
  "Export everything": "Xuất tất cả",
  "Saves your whole Harbor setup to one file: theme, home layout, settings, addons, profiles, watchlist, player layouts, watch progress, and more. Your Stremio sign-in is left out on purpose.":
    "Lưu toàn bộ thiết lập Harbor vào một tệp: chủ đề, bố cục trang chủ, cài đặt, tiện ích bổ sung, hồ sơ, danh sách xem, bố cục trình phát, tiến độ xem và nhiều nội dung khác. Thông tin đăng nhập Stremio được chủ động loại trừ.",
  "Restore from a backup": "Khôi phục từ bản sao lưu",
  "Loads a backup file and replaces your current setup with it. Perfect for a new computer. Your Stremio sign-in on this device stays as is.":
    "Tải tệp sao lưu và thay thế thiết lập hiện tại. Rất phù hợp khi chuyển sang máy tính mới. Thông tin đăng nhập Stremio trên thiết bị này vẫn được giữ nguyên.",
  "Could not build the backup file.": "Không thể tạo tệp sao lưu.",
  "Could not read that file.": "Không thể đọc tệp đó.",
  "an unknown date": "ngày không xác định",
  "Restore this backup?": "Khôi phục bản sao lưu này?",
  "This replaces your current Harbor setup (theme, home layout, settings, addons, profiles, and more) with the {n} saved entries in this file. Your Stremio sign-in stays as is. Harbor reloads when it finishes.":
    "Thao tác này sẽ thay thế thiết lập Harbor hiện tại của bạn (giao diện, bố cục trang chủ, cài đặt, tiện ích bổ sung, hồ sơ và nhiều mục khác) bằng {n} mục đã lưu trong tệp này. Trạng thái đăng nhập Stremio của bạn vẫn được giữ nguyên. Harbor sẽ tải lại sau khi hoàn tất.",
  "Saved {when} from Harbor {app}.": "Đã lưu vào {when} từ Harbor {app}.",
  "Restoring...": "Đang khôi phục...",
  "Restore and reload": "Khôi phục và tải lại",
  "Xtream credentials were left out of this backup.":
    "Thông tin đăng nhập Xtream không được đưa vào bản sao lưu này.",
  "Get beta updates": "Nhận bản cập nhật beta",
  "Receive early builds with the newest fixes before they reach the stable release. Betas can be rough around the edges; switch this off to return to stable at the next update.":
    "Nhận sớm các bản dựng có bản sửa lỗi mới nhất trước khi được phát hành ổn định. Bản beta có thể chưa hoàn thiện; hãy tắt tùy chọn này để trở lại bản ổn định trong lần cập nhật tiếp theo.",
  "Catch stremio:// install links inside Harbor": "Mở liên kết cài đặt stremio:// trong Harbor",
  "Harbor's in-app installer animates the manifest install and keeps you in context. Anything Harbor installs is also synced to your Stremio account, so the official app stays the canonical library. Turn this off and Stremio becomes the only handler for stremio:// links; Harbor still installs anything you trigger from inside the app (Configure & install, paste, drag-and-drop).":
    "Trình cài đặt trong Harbor sẽ hiển thị hoạt ảnh khi cài manifest và giúp bạn không bị gián đoạn. Mọi nội dung Harbor cài đặt cũng được đồng bộ với tài khoản Stremio của bạn, nên ứng dụng chính thức vẫn là thư viện chuẩn. Nếu tắt tùy chọn này, Stremio sẽ là ứng dụng duy nhất xử lý liên kết stremio://; Harbor vẫn cài đặt mọi nội dung bạn kích hoạt từ trong ứng dụng (Định cấu hình và cài đặt, dán, kéo và thả).",
  "Heads up: if Stremio is also installed, Windows may ask which app to use the first time a stremio:// link fires. Pick Harbor to make it stick.":
    "Lưu ý: nếu Stremio cũng được cài đặt, Windows có thể hỏi ứng dụng cần dùng trong lần đầu mở liên kết stremio://. Chọn Harbor để đặt làm mặc định.",
  "stremio:// links now open in the Stremio app. Harbor will only install when you trigger it from inside Harbor.":
    "Liên kết stremio:// hiện sẽ mở trong ứng dụng Stremio. Harbor chỉ cài đặt khi bạn kích hoạt từ trong Harbor.",
  "Checking harbor.site for a newer build.": "Đang kiểm tra bản dựng mới hơn trên harbor.site.",
  "Downloading {pct}%": "Đang tải xuống {pct}%",
  "Downloaded. Ready to install and restart.": "Đã tải xuống. Sẵn sàng cài đặt và khởi động lại.",
  "Installing. Harbor will restart.": "Đang cài đặt. Harbor sẽ khởi động lại.",
  "A new version is ready to download.": "Đã có phiên bản mới để tải xuống.",
  "You're on the latest version.": "Bạn đang dùng phiên bản mới nhất.",
  "Couldn't reach the update server. Try again in a moment.":
    "Không thể kết nối với máy chủ cập nhật. Hãy thử lại sau giây lát.",
  "Harbor checks automatically every few hours.": "Harbor tự động kiểm tra vài giờ một lần.",
  "Harbor {version} available": "Đã có Harbor {version}",
  "Update now": "Cập nhật ngay",
  "Check for updates": "Kiểm tra bản cập nhật",
  "Show on Discord": "Hiển thị trên Discord",
  "Display what you are watching on your Discord profile, with the show poster and a live progress bar. Requires the Discord desktop app to be running.":
    "Hiển thị nội dung bạn đang xem trên hồ sơ Discord, kèm áp phích và thanh tiến trình trực tiếp. Yêu cầu ứng dụng Discord trên máy tính đang chạy.",
  "Hide the title": "Ẩn tiêu đề",
  "Show 'Watching something' with no show name or poster.":
    "Hiển thị 'Đang xem nội dung nào đó' mà không có tên phim hay áp phích.",
  "Show while paused": "Hiển thị khi tạm dừng",
  "Keep the presence visible when playback is paused.":
    "Tiếp tục hiển thị trạng thái khi tạm dừng phát.",
  "Show while browsing": "Hiển thị khi duyệt",
  "Display 'Browsing Harbor' when nothing is playing.":
    "Hiển thị 'Đang duyệt Harbor' khi không phát nội dung nào.",
  "Show poster": "Hiển thị áp phích",
  "Reveal the show or movie artwork. Off keeps the title but hides the poster.":
    "Hiển thị hình ảnh của phim bộ hoặc phim. Khi tắt, tiêu đề vẫn hiện nhưng áp phích sẽ bị ẩn.",
  "Show elapsed time": "Hiển thị thời gian đã xem",
  "Display the live progress bar showing how far into the title you are.":
    "Hiển thị thanh tiến trình trực tiếp cho biết bạn đã xem đến đâu.",
  "Watch party join button": "Nút tham gia buổi xem chung",
  "Add a Join button with your room link while you're in a watch party.":
    "Thêm nút Tham gia kèm liên kết phòng khi bạn đang trong buổi xem chung.",
  "And for the naughty ones: browsing or rating an adult addon never shows on Discord.":
    "Và với những ai hơi nghịch ngợm: việc duyệt hoặc đánh giá tiện ích bổ sung người lớn sẽ không bao giờ hiển thị trên Discord.",
  "OMDB daily budget": "Hạn mức OMDB hằng ngày",
  "Save an OMDB key in Library & metadata to enable rating fetches.":
    "Lưu khóa OMDB trong Thư viện và siêu dữ liệu để bật tính năng lấy điểm đánh giá.",
  "Key rejected. Check it on Library & metadata.":
    "Khóa bị từ chối. Hãy kiểm tra trong Thư viện và siêu dữ liệu.",
  "{used} / {limit} requests today.": "Hôm nay đã dùng {used} / {limit} yêu cầu.",
  "Budget exhausted, resets at midnight UTC.": "Đã hết hạn mức, sẽ đặt lại vào nửa đêm UTC.",
  "Reset counter": "Đặt lại bộ đếm",
  "Replay walkthrough": "Xem lại hướng dẫn",
  "Re-runs the welcome flow and clears every dismissed tip.":
    "Chạy lại quy trình chào mừng và đặt lại mọi mẹo đã ẩn.",
  "Restore dismissed hints": "Khôi phục gợi ý đã ẩn",
  "Brings back the small in-app tips you've dismissed without redoing the welcome flow.":
    "Hiển thị lại các mẹo nhỏ trong ứng dụng mà bạn đã ẩn mà không cần thực hiện lại quy trình chào mừng.",
  "Desktop (Tauri 2 / WebView2)": "Máy tính (Tauri 2 / WebView2)",
  "Bug reports": "Báo cáo lỗi",
  "Repair library": "Sửa chữa thư viện",
  "Sign in to Stremio first. The repair scans only the active profile's library.":
    "Trước tiên, hãy đăng nhập Stremio. Tính năng sửa chữa chỉ quét thư viện của hồ sơ đang hoạt động.",
  "Failed: {error}": "Không thành công: {error}",
  "Library is empty. Nothing to repair.": "Thư viện trống. Không có gì cần sửa chữa.",
  "{repaired} fixed, {clean} already clean": "Đã sửa {repaired}, {clean} mục không có lỗi",
  ", {n} unrepairable": ", không thể sửa {n} mục",
  "Rewrites every library item to match Stremio's exact schema. Run once if your Stremio app started crashing after Harbor synced playback.":
    "Viết lại mọi mục trong thư viện để khớp chính xác với cấu trúc dữ liệu của Stremio. Chạy một lần nếu ứng dụng Stremio bắt đầu bị lỗi sau khi Harbor đồng bộ trạng thái phát.",
  "Fetching {n} items…": "Đang tải {n} mục…",
  "Fetching library index…": "Đang tải chỉ mục thư viện…",
  "{n} items need repair.": "Có {n} mục cần sửa.",
  "Checking {n} items…": "Đang kiểm tra {n} mục…",
  "Pushing {pushed} of {total}…": "Đang đẩy {pushed}/{total}…",
  "Done.": "Xong.",
  "Working…": "Đang xử lý…",
  "Run again": "Chạy lại",
  "Repair now": "Sửa ngay",
  "Web build": "Bản web",
  "Where your data lives": "Nơi lưu dữ liệu của bạn",
  "Everything you save here stays in this browser. Your Stremio login, API keys, watch progress, picker cache, dismissed tips. Harbor servers never see any of it. Clearing your browser data wipes it.":
    "Mọi thứ bạn lưu tại đây đều nằm trong trình duyệt này: thông tin đăng nhập Stremio, khóa API, tiến độ xem, bộ nhớ đệm của trình chọn và các mẹo đã bỏ qua. Máy chủ Harbor không bao giờ thấy bất kỳ dữ liệu nào trong số đó. Việc xóa dữ liệu trình duyệt sẽ xóa sạch tất cả.",
  "The web build can't run mpv, the trickplay generator, the local bandwidth probe, or your own Cloudflare relay. If you want HDR passthrough, TrueHD or DTS-HD audio, and smoother seeking, grab the desktop app.":
    "Bản web không thể chạy mpv, trình tạo trickplay, công cụ đo băng thông cục bộ hoặc relay Cloudflare riêng của bạn. Nếu muốn truyền thẳng HDR, âm thanh TrueHD hoặc DTS-HD và tua mượt hơn, hãy tải ứng dụng máy tính.",
  "Get Harbor for desktop": "Tải Harbor cho máy tính",
  "Source code": "Mã nguồn",
  "Your relay is live": "Relay của bạn đang hoạt động",
  "Connected to relay": "Đã kết nối với relay",
  "Watch Together": "Xem cùng nhau",
  "Synchronizes playback state between participants in the same room.":
    "Đồng bộ trạng thái phát giữa những người tham gia trong cùng một phòng.",
  "Test connection": "Kiểm tra kết nối",
  "Pings your Worker at /health to confirm it's reachable from this device.":
    "Gửi ping đến Worker của bạn tại /health để xác nhận thiết bị này có thể truy cập.",
  "Testing…": "Đang kiểm tra…",
  "Relay version {version}. Update available.": "Relay phiên bản {version}. Có bản cập nhật.",
  "Relay is current (v{version}).": "Relay đã được cập nhật (v{version}).",
  "Harbor's public relay updates automatically; nothing to do.":
    "Relay công khai của Harbor tự động cập nhật, bạn không cần làm gì.",
  "Redeploy to pick up the latest Watch Together fixes. The in-app banner clears once the new version is live.":
    "Triển khai lại để nhận các bản sửa lỗi Xem cùng nhau mới nhất. Biểu ngữ trong ứng dụng sẽ biến mất khi phiên bản mới hoạt động.",
  "Running the latest Watch Together protocol.": "Đang chạy giao thức Xem cùng nhau mới nhất.",
  "Redeploy instructions": "Hướng dẫn triển khai lại",
  "Backup credentials": "Sao lưu thông tin xác thực",
  "Cloudflare shows API tokens only once. Save a copy now or you'll lose the ability to stop or redeploy this relay from Harbor.":
    "Cloudflare chỉ hiển thị token API một lần. Hãy lưu một bản sao ngay, nếu không bạn sẽ không thể dừng hoặc triển khai lại relay này từ Harbor.",
  "Relay verified end-to-end": "Đã xác minh relay từ đầu đến cuối",
  "Relay test failed": "Kiểm tra relay thất bại",
  "Redeploy relay": "Triển khai lại relay",
  "Stopping…": "Đang dừng…",
  "Stop relay": "Dừng relay",
  "Forget URL": "Quên URL",
  "Use a different URL": "Dùng URL khác",
  "Deploy mine instead": "Thay vào đó, triển khai relay của tôi",
  "Deploy a relay": "Triển khai relay",
  "Deploy a relay (desktop only)": "Triển khai relay (chỉ trên máy tính)",
  "Relay deployment requires the Cloudflare API, which is unavailable to browser clients. Use the desktop build to deploy a Worker, then enter the resulting URL below.":
    "Việc triển khai relay cần API Cloudflare nhưng API này không khả dụng trên trình duyệt. Hãy dùng bản máy tính để triển khai Worker, sau đó nhập URL nhận được vào bên dưới.",
  "Enter an existing relay URL:": "Nhập URL relay hiện có:",
  "Only enter URLs for relays you operate or trust. A relay only carries Watch Together sync messages (play, pause, seek). Nothing else passes through it.":
    "Chỉ nhập URL của relay do bạn vận hành hoặc tin cậy. Relay chỉ truyền các thông báo đồng bộ Xem cùng nhau (phát, tạm dừng, tua). Không có dữ liệu nào khác đi qua relay.",
  "Hit your daily quota? Use Harbor's public relay, or host your own.":
    "Đã hết hạn mức hằng ngày? Hãy dùng relay công khai của Harbor hoặc tự lưu trữ relay.",
  "Use Harbor's public relay": "Dùng relay công khai của Harbor",
  "Documentation: run your own relay": "Tài liệu: tự chạy relay",
  "Install failed": "Cài đặt thất bại",
  "Installed via {label}": "Đã cài đặt qua {label}",
  "Save a debrid key above (TorBox, Real-Debrid, AllDebrid, Premiumize, or Debrid-Link) to enable this.":
    "Lưu khóa debrid ở trên (TorBox, Real-Debrid, AllDebrid, Premiumize hoặc Debrid-Link) để bật tính năng này.",
  "Couldn't install. Double-check the URL and try again.":
    "Không thể cài đặt. Hãy kiểm tra lại URL rồi thử lại.",
  "Paste the manifest URL the configure page gave you":
    "Dán URL manifest do trang cấu hình cung cấp",
  "View all": "Xem tất cả",
  "Where alerts go": "Nơi nhận cảnh báo",
  "Connect Discord or Telegram and Harbor posts a message when something you follow is about to drop. Hit Test to send yourself a sample first.":
    "Kết nối Discord hoặc Telegram để Harbor gửi tin nhắn khi nội dung bạn theo dõi sắp phát hành. Trước tiên, nhấn Kiểm tra để tự gửi một tin nhắn mẫu.",
  "What to send": "Nội dung gửi",
  "Pick which calendars feed your alerts. Items are deduped across sources before sending.":
    "Chọn lịch dùng để tạo cảnh báo. Các mục trùng lặp giữa các nguồn sẽ được loại bỏ trước khi gửi.",
  "Media types": "Loại nội dung",
  "Filter by type after the sources merge. Leave them all on to send everything.":
    "Lọc theo loại sau khi hợp nhất các nguồn. Bật tất cả để gửi mọi nội dung.",
  AUTOMATIONS: "TỰ ĐỘNG HÓA",
  "Anime tweaks": "Tinh chỉnh anime",
  "Anime4K real-time upscaling, smooth motion, and where SVP fits in. All the anime-specific picture enhancements in one place.":
    "Nâng cấp hình ảnh theo thời gian thực bằng Anime4K, làm mượt chuyển động và cách SVP hoạt động. Mọi cải tiến hình ảnh dành riêng cho anime đều ở cùng một nơi.",
  "Real-time GPU upscaling that sharpens lines and cleans up gradients on anime, built right into Harbor's player. The one-tap setup below grabs the shaders; nothing else to install.":
    "Nâng cấp hình ảnh bằng GPU theo thời gian thực, giúp đường nét sắc hơn và dải màu mượt hơn trong anime, được tích hợp ngay vào trình phát của Harbor. Thiết lập một chạm bên dưới sẽ tải các shader; không cần cài thêm gì khác.",
  "Enable Anime4K": "Bật Anime4K",
  "Sharper lines and cleaner gradients on anime, in real time. Heaviest on the graphics card of everything here.":
    "Giúp đường nét sắc hơn và dải màu mượt hơn trong anime theo thời gian thực. Tính năng dùng card đồ họa nhiều nhất tại đây.",
  "Show Anime4K indicator": "Hiện chỉ báo Anime4K",
  "A small badge over the video (with live FPS) that only appears when Anime4K is actually running. Follows your anime-only setting.":
    "Một huy hiệu nhỏ trên video (kèm FPS trực tiếp), chỉ xuất hiện khi Anime4K thực sự đang chạy. Tuân theo cài đặt chỉ áp dụng cho anime.",
  "Smooth motion": "Làm mượt chuyển động",
  "Anime is drawn on twos and threes, so fast pans can judder. Smoothing fills in the gaps so motion glides.":
    "Anime thường chỉ thay đổi hình sau mỗi hai hoặc ba khung hình nên các cảnh lia nhanh có thể bị giật. Tính năng làm mượt sẽ chèn thêm khung hình để chuyển động trơn tru hơn.",
  "Harbor's built-in frame interpolation. Smooths panning, best on anime. Needs a display refresh rate above the video's frame rate, and can stutter on weak GPUs. Lighter than SVP.":
    "Tính năng nội suy khung hình tích hợp của Harbor. Làm mượt cảnh lia, phù hợp nhất với anime. Cần màn hình có tần số quét cao hơn tốc độ khung hình của video và có thể bị giật trên GPU yếu. Nhẹ hơn SVP.",
  "SVP frame interpolation": "Nội suy khung hình SVP",
  "Genuine 48/60fps motion on anime, rendered right inside Harbor's player. SVP supplies the engine (VapourSynth + svpflow) and runs in your tray for licensing; Harbor's own player applies the interpolation, so it stays embedded and fully under your control. One-time install, then flip it on.":
    "Chuyển động 48/60fps thực sự cho anime, được kết xuất ngay trong trình phát của Harbor. SVP cung cấp bộ máy (VapourSynth + svpflow) và chạy trong khay hệ thống để xác thực giấy phép; trình phát riêng của Harbor thực hiện nội suy nên tính năng vẫn được tích hợp và hoàn toàn do bạn kiểm soát. Chỉ cần cài một lần rồi bật lên.",
  "SVP (free)": "SVP (miễn phí)",
  "Install SVP once (the free tier is enough). It bundles VapourSynth + svpflow; Harbor reuses them, no extra setup.":
    "Cài SVP một lần (gói miễn phí là đủ). SVP đi kèm VapourSynth + svpflow; Harbor sẽ dùng lại mà không cần thiết lập thêm.",
  "Installed and detected. Harbor found its interpolation engine and will drive it directly.":
    "Đã cài đặt và phát hiện. Harbor đã tìm thấy bộ máy nội suy và sẽ điều khiển trực tiếp.",
  "SVP is installed but Harbor couldn't find its engine files (svpflow + VapourSynth). Try repairing the SVP install, or reopen SVP once.":
    "SVP đã được cài đặt nhưng Harbor không tìm thấy các tệp bộ máy (svpflow + VapourSynth). Hãy thử sửa chữa bản cài đặt SVP hoặc mở lại SVP một lần.",
  "Get SVP (free)": "Tải SVP (miễn phí)",
  "Open SVP": "Mở SVP",
  "Enable SVP": "Bật SVP",
  "Harbor's player applies the interpolation itself, embedded like normal playback, and starts SVP Manager in the tray for licensing. Restart playback to apply. If video goes black or won't start, turn this off.":
    "Trình phát của Harbor tự thực hiện nội suy, tích hợp như khi phát bình thường, đồng thời khởi động SVP Manager trong khay hệ thống để xác thực giấy phép. Khởi động lại quá trình phát để áp dụng. Nếu video bị đen hoặc không phát được, hãy tắt tính năng này.",
  "Finish the install above first. Flipping this on now won't do anything until Harbor can find SVP's engine.":
    "Trước tiên, hãy hoàn tất quá trình cài đặt ở trên. Bật tùy chọn này lúc này sẽ không có tác dụng cho đến khi Harbor tìm thấy bộ máy của SVP.",
  "Couldn't start SVP Manager: {err}": "Không thể khởi động SVP Manager: {err}",
  "Couldn't set up SVP: {err}": "Không thể thiết lập SVP: {err}",
  "Anime4K and smooth-motion run on the bundled mpv engine in the Harbor desktop app. They have no effect in the browser.":
    "Anime4K và tính năng làm mượt chuyển động chạy trên bộ máy mpv đi kèm ứng dụng Harbor cho máy tính. Các tính năng này không có tác dụng trong trình duyệt.",
  "Download the desktop app to use anime enhancements.":
    "Tải ứng dụng cho máy tính để dùng các cải tiến dành cho anime.",
  "Match the picture quality to your computer, smooth out weak connections, and fine-tune the mpv engine with plain-language controls.":
    "Điều chỉnh chất lượng hình ảnh phù hợp với máy tính, giúp phát mượt hơn khi kết nối yếu và tinh chỉnh bộ máy mpv bằng các tùy chọn dễ hiểu.",
  "Picture quality": "Chất lượng hình ảnh",
  "One choice that sets how hard your computer works to make video look its best. Pick the one that matches your machine. Takes effect on the next thing you play.":
    "Một lựa chọn duy nhất để thiết lập mức độ máy tính xử lý nhằm cho hình ảnh video đẹp nhất. Chọn mức phù hợp với máy của bạn. Có hiệu lực với nội dung phát tiếp theo.",
  "Smooth on weak PCs": "Mượt trên PC yếu",
  "Older laptops · low-end · battery · anything that stutters":
    "Laptop cũ · cấu hình thấp · dùng pin · mọi máy hay bị giật",
  "Turns off the fancy scaling and effects so video just plays. The lightest on your machine. Pick this if anything ever stutters or your fan screams.":
    "Tắt các hiệu ứng và tính năng nâng cấp hình ảnh cầu kỳ để video chỉ cần phát mượt. Nhẹ nhất cho máy. Chọn mức này nếu video bị giật hoặc quạt máy chạy quá ồn.",
  "Most computers · the default": "Hầu hết máy tính · mặc định",
  "Good-looking video without working your machine hard. Leave it here unless you have a reason to change.":
    "Hình ảnh đẹp mà không khiến máy phải hoạt động nhiều. Hãy giữ nguyên mức này trừ khi bạn có lý do để thay đổi.",
  "Maximum quality": "Chất lượng tối đa",
  "Strong desktops with a dedicated graphics card": "Máy tính để bàn mạnh có card đồ họa rời",
  "Sharper upscaling and smoother gradients in dark scenes, at the cost of more graphics-card load. Skip it on laptops and integrated graphics.":
    "Nâng cấp hình ảnh sắc nét hơn và dải màu mượt hơn trong các cảnh tối, đổi lại card đồ họa phải xử lý nhiều hơn. Không nên dùng trên laptop và card đồ họa tích hợp.",
  "Hardware acceleration": "Tăng tốc phần cứng",
  "Let your graphics card do the heavy lifting of decoding video. It saves battery and keeps the CPU cool. Auto is right for almost everyone; only switch if playback looks wrong or won't start.":
    "Để card đồ họa đảm nhiệm phần lớn việc giải mã video. Tính năng này giúp tiết kiệm pin và giảm tải cho CPU. Tự động phù hợp với hầu hết mọi người; chỉ chuyển chế độ nếu phát bị lỗi hình hoặc không bắt đầu được.",
  "Force on": "Luôn bật",
  "Off (use CPU)": "Tắt (dùng CPU)",
  "The CPU decodes everything. Most compatible, but it runs hot and can stutter on 4K. Use this only if the picture glitches with hardware decoding on.":
    "CPU giải mã mọi nội dung. Tương thích tốt nhất nhưng máy sẽ nóng và có thể bị giật khi phát 4K. Chỉ dùng chế độ này nếu hình ảnh bị lỗi khi bật giải mã phần cứng.",
  "Forces the graphics card on. Smoothest and coolest, but a few old or unusual files may refuse to play. Switch back to Auto if something won't start.":
    "Buộc dùng card đồ họa. Mượt nhất và ít nóng máy nhất, nhưng một số tệp cũ hoặc không phổ biến có thể không phát được. Chuyển lại Tự động nếu nội dung không bắt đầu phát.",
  "Harbor uses the graphics card when it's safe and falls back to the CPU when it isn't. The right call for almost everyone.":
    "Harbor dùng card đồ họa khi an toàn và chuyển sang CPU khi cần. Đây là lựa chọn phù hợp với hầu hết mọi người.",
  "Picture adjustments": "Điều chỉnh hình ảnh",
  "Nudge the image to taste. Start with a one-tap look below, then fine-tune with the dials. Everything resets cleanly, so you can't break anything.":
    "Điều chỉnh hình ảnh theo ý thích. Bắt đầu với một giao diện một chạm bên dưới, sau đó tinh chỉnh bằng các nút xoay. Mọi thứ đều có thể đặt lại hoàn toàn nên bạn không thể làm hỏng gì.",
  "Brighten dark movies": "Làm sáng phim tối",
  "Lifts shadows so the pitch-black scenes are actually watchable.":
    "Làm sáng vùng tối để những cảnh đen kịt vẫn có thể xem rõ.",
  "Punchier color": "Màu sắc nổi bật hơn",
  "Richer, more vivid picture with a touch more contrast.":
    "Hình ảnh đậm đà, sống động hơn với độ tương phản cao hơn một chút.",
  "Easy on the eyes": "Dịu mắt",
  "Softer and dimmer, kinder for late-night watching.":
    "Dịu và tối hơn, dễ chịu hơn khi xem khuya.",
  "Crisp (anime & cartoons)": "Sắc nét (anime & hoạt hình)",
  "Sharper lines and a little more pop.": "Đường nét rõ hơn và hình ảnh nổi bật hơn một chút.",
  Brightness: "Độ sáng",
  Contrast: "Độ tương phản",
  Saturation: "Độ bão hòa",
  "Gamma (midtones)": "Gamma (tông trung)",
  Sharpen: "Độ sắc nét",
  "Reset picture": "Đặt lại hình ảnh",
  "Color & HDR": "Màu sắc & HDR",
  "How Harbor squeezes HDR movies onto a normal screen. Auto is right for almost everyone; the curves below just change the look (punchy vs soft). Only matters on HDR sources.":
    "Cách Harbor hiển thị phim HDR trên màn hình thường. Tự động phù hợp với hầu hết mọi người; các đường cong bên dưới chỉ thay đổi phong cách hình ảnh (rực rỡ hoặc dịu). Chỉ có tác dụng với nguồn HDR.",
  "Tone-mapping curve": "Đường cong ánh xạ tông màu",
  "Auto (recommended)": "Tự động (khuyên dùng)",
  "Reference (bt.2390)": "Tham chiếu (bt.2390)",
  "Filmic (Hable)": "Điện ảnh (Hable)",
  "Balanced (Mobius)": "Cân bằng (Mobius)",
  "Soft (Reinhard)": "Dịu (Reinhard)",
  "Modern (Spline)": "Hiện đại (Spline)",
  "Boost SDR video toward HDR": "Tăng cường video SDR theo hướng HDR",
  "On an HDR display, stretches normal (non-HDR) movies to use the extra brightness range. Leave off on a regular screen; it can look washed out.":
    "Trên màn hình HDR, mở rộng phim thường (không phải HDR) để tận dụng dải độ sáng bổ sung. Hãy tắt trên màn hình thường vì hình ảnh có thể bị nhợt nhạt.",
  "Slow or unstable connection": "Kết nối chậm hoặc không ổn định",
  "If video keeps pausing to buffer, or you're on spotty Wi-Fi or a far-away server, this gives Harbor a bigger head start so playback rides through the rough patches.":
    "Nếu video liên tục tạm dừng để tải đệm, hoặc Wi-Fi chập chờn hay máy chủ ở xa, tùy chọn này giúp Harbor tải trước nhiều hơn để phát mượt qua những lúc kết nối kém.",
  "Build a bigger buffer": "Tăng bộ đệm",
  "Loads more of the video ahead of time before playing. Smoother on weak connections, uses a little more memory and takes a moment longer to start.":
    "Tải trước nhiều nội dung video hơn trước khi phát. Mượt hơn khi kết nối yếu, dùng thêm một chút bộ nhớ và mất thêm chút thời gian để bắt đầu.",
  "For laptop speakers and headphones. Movies mixed for 5.1 or 7.1 surround can sound hollow or have quiet dialogue on two speakers. This folds them down properly.":
    "Dành cho loa laptop và tai nghe. Phim phối âm vòm 5.1 hoặc 7.1 có thể nghe rỗng hoặc lời thoại quá nhỏ trên hai loa. Tùy chọn này sẽ trộn âm xuống đúng cách.",
  "Mix surround sound down to stereo": "Trộn âm thanh vòm xuống stereo",
  "Turn on if you watch on a laptop or headphones and dialogue feels too quiet next to the effects. Leave off if you have a real surround setup or a soundbar.":
    "Bật nếu bạn xem trên laptop hoặc bằng tai nghe và lời thoại quá nhỏ so với hiệu ứng. Hãy tắt nếu bạn có hệ thống âm thanh vòm thực thụ hoặc soundbar.",
  "Advanced (mpv.conf)": "Nâng cao (mpv.conf)",
  "The escape hatch for power users. One mpv option per line as key=value, exactly like mpv.conf. These apply last, so they override every dial above. Anything Harbor can't read is skipped, so a typo won't break playback. Restart playback to apply.":
    "Lối tùy chỉnh dành cho người dùng chuyên sâu. Mỗi dòng nhập một tùy chọn mpv theo dạng key=value, giống hệt mpv.conf. Các tùy chọn này được áp dụng sau cùng nên sẽ ghi đè mọi thiết lập bên trên. Mọi nội dung Harbor không đọc được sẽ bị bỏ qua, vì vậy lỗi chính tả sẽ không làm hỏng việc phát. Khởi động lại nội dung đang phát để áp dụng.",
  "1 option active": "1 tùy chọn đang hoạt động",
  "{n} options active": "{n} tùy chọn đang hoạt động",
  "1 line skipped (not valid)": "Đã bỏ qua 1 dòng (không hợp lệ)",
  "{n} lines skipped (not valid)": "Đã bỏ qua {n} dòng (không hợp lệ)",
  "Empty. The dials above cover what most people ever need.":
    "Đang trống. Các thiết lập bên trên đáp ứng hầu hết mọi nhu cầu.",
  "Heads up: {keys} can load outside scripts or open your player to the network. Only keep these if you know exactly what they do.":
    "Lưu ý: {keys} có thể tải tập lệnh bên ngoài hoặc cho phép truy cập trình phát qua mạng. Chỉ giữ lại nếu bạn biết chính xác tác dụng của chúng.",
  "See the mpv.conf your dials above generate": "Xem mpv.conf được tạo từ các thiết lập bên trên",
  "These tune the bundled mpv engine, which runs in the Harbor desktop app. They have no effect in the browser.":
    "Các tùy chọn này tinh chỉnh công cụ mpv tích hợp, chạy trong ứng dụng Harbor cho máy tính. Chúng không có tác dụng trên trình duyệt.",
  "Download the desktop app to use video tuning.": "Tải ứng dụng cho máy tính để tinh chỉnh video.",
  "Ask to resume or start over": "Hỏi tiếp tục xem hay xem lại từ đầu",
  "When you hit Play on something you've partly watched, show a prompt to resume from where you left off or start over. Also covers items synced from Stremio or Trakt.":
    "Khi bạn nhấn Phát nội dung đã xem dở, hiển thị lời nhắc tiếp tục từ vị trí đã dừng hoặc xem lại từ đầu. Cũng áp dụng cho nội dung được đồng bộ từ Stremio hoặc Trakt.",
  "Aspect ratio": "Tỷ lệ khung hình",
  "Default picture shape on the mpv engine. Fit keeps the source as-is with any black bars; the rest stretch or crop to fill, handy for old 4:3 shows on a widescreen TV.":
    "Tỷ lệ khung hình mặc định trên công cụ mpv. Vừa khung giữ nguyên tỷ lệ nguồn cùng các dải đen nếu có; các tùy chọn còn lại sẽ kéo giãn hoặc cắt để lấp đầy màn hình, hữu ích khi xem phim bộ 4:3 cũ trên TV màn hình rộng.",
  Fit: "Vừa khung",
  Fill: "Lấp đầy",
  "16:9": "16:9",
  "4:3": "4:3",
  "21:9": "21:9",
  "1.85:1": "1.85:1",
  "2.39:1": "2.39:1",
  "Want to change the ratio mid-playback? The live aspect button is hidden by default to keep the player tidy.":
    "Muốn đổi tỷ lệ khi đang phát? Nút tỷ lệ trực tiếp được ẩn theo mặc định để giao diện trình phát gọn gàng.",
  "Turn it on in Player layout": "Bật trong Bố cục trình phát",
  "Auto-play next episode": "Tự động phát tập tiếp theo",
  "When an episode ends, automatically start the next one. Off lets the episode finish and stop.":
    "Khi một tập kết thúc, tự động bắt đầu tập tiếp theo. Nếu tắt, tập sẽ phát hết rồi dừng.",
  "Show P2P status overlay": "Hiển thị lớp phủ trạng thái P2P",
  "Peers, speed and progress chip on the player during torrent playback. Turn off to keep the player clean.":
    "Hiển thị số máy ngang hàng, tốc độ và tiến trình trên trình phát khi phát torrent. Tắt để giữ giao diện trình phát gọn gàng.",
  "Source:": "Nguồn:",
  "About 200 lines of JavaScript, no dependencies. Read it before deploying if you want to know what runs.":
    "Khoảng 200 dòng JavaScript, không có phần phụ thuộc. Hãy đọc trước khi triển khai nếu bạn muốn biết mã nào sẽ chạy.",
  "For the manual path:": "Đối với cách thủ công:",
  "20+ and": "20+ và",
  "CLI.": "CLI.",
  "Generate a Cloudflare API token with": "Tạo token API Cloudflare với",
  and: "và",
  "permissions at": "quyền tại",
  "Paste it into Harbor.": "Dán token vào Harbor.",
  "Wait for the upload to finish. The relay URL gets written to":
    "Chờ quá trình tải lên hoàn tất. URL relay sẽ được ghi vào",
  "in Harbor settings.": "trong phần cài đặt Harbor.",
  "Save the worker source. Copy": "Lưu mã nguồn worker. Sao chép",
  "from the Harbor repo into a new directory as": "từ kho mã Harbor vào một thư mục mới với tên",
  "Save this": "Lưu nội dung này",
  "next to it:": "bên cạnh tệp đó:",
  "Note the URL Cloudflare returns. It looks like": "Ghi lại URL do Cloudflare trả về. URL có dạng",
  "In Harbor: Settings, Harbor Relay, then": "Trong Harbor: Cài đặt, Harbor Relay, rồi",
  "Paste the URL with": "Dán URL với",
  "as the scheme instead of": "làm giao thức thay cho",
  "Settings, Harbor Relay, then": "Cài đặt, Harbor Relay, rồi",
  "The test calls": "Quy trình kiểm tra gọi",
  "and confirms the worker is reachable and running a current version. A passing test means Watch Together rooms will connect.":
    "và xác nhận worker có thể truy cập được cũng như đang chạy phiên bản hiện tại. Nếu kiểm tra đạt, các phòng Xem cùng nhau sẽ kết nối được.",
  "A relay URL is shareable. Anyone with the URL can join Watch Together rooms hosted on your relay. The unique":
    "Có thể chia sẻ URL relay. Bất kỳ ai có URL đều có thể tham gia các phòng Xem cùng nhau được lưu trữ trên relay của bạn. Tên miền phụ duy nhất",
  "subdomain acts as the access token. There is no login.":
    "đóng vai trò là token truy cập. Không cần đăng nhập.",
  "To run a public relay, post the": "Để vận hành relay công khai, hãy đăng",
  "URL on r/Stremio or wherever your community lives. Other Harbor users paste it into Settings, Harbor Relay,":
    "URL lên r/Stremio hoặc nơi cộng đồng của bạn hoạt động. Người dùng Harbor khác dán URL này vào Cài đặt, Harbor Relay,",
  "returns JSON with the worker version. Used by the test button.":
    "trả về JSON chứa phiên bản worker. Được nút kiểm tra sử dụng.",
  "with a WebSocket upgrade: opens a Watch Together room. State is held in a Durable Object, no persistence beyond the active session.":
    "với nâng cấp WebSocket: mở một phòng Xem cùng nhau. Trạng thái được giữ trong Durable Object và không được lưu sau phiên hoạt động.",
  "Add Custom Source": "Thêm nguồn tùy chỉnh",
  "Provide a JSON link or paste it directly.": "Cung cấp liên kết JSON hoặc dán trực tiếp.",
  "JSON URL": "URL JSON",
  "Paste JSON": "Dán JSON",
  "URL cannot be empty": "URL không được để trống",
  "Failed to fetch JSON": "Không thể tải JSON",
  "JSON cannot be empty": "JSON không được để trống",
  "Invalid SourceRow JSON format": "Định dạng JSON SourceRow không hợp lệ",
  "Add Source": "Thêm nguồn",
  "Edit Folder Images": "Chỉnh sửa hình ảnh thư mục",
  "Cover Image URL": "URL ảnh bìa",
  "Focus GIF URL": "URL GIF khi lấy nét",
  "Addon not installed": "Chưa cài đặt tiện ích bổ sung",
  "This section depends on the addon": "Mục này phụ thuộc vào tiện ích bổ sung",
  "You must install this addon in your Stremio account first so Harbor can fetch its works.":
    "Trước tiên, bạn phải cài đặt tiện ích bổ sung này trong tài khoản Stremio để Harbor có thể tải các tác phẩm từ đó.",
  "Missing TMDB Key": "Thiếu khóa TMDB",
  "This section relies on TMDB discovery features.":
    "Mục này phụ thuộc vào các tính năng khám phá của TMDB.",
  "Please add your TMDB API key in the Library & Metadata settings to view this folder.":
    "Vui lòng thêm khóa API TMDB trong phần cài đặt Thư viện & Siêu dữ liệu để xem thư mục này.",
  OK: "OK",
  "Loading...": "Đang tải...",
  "Bring your Letterboxd watchlist, diary, liked films and lists into Harbor via the Stremboxd bridge.":
    "Đưa danh sách xem, nhật ký, phim đã thích và các danh sách trên Letterboxd vào Harbor qua cầu nối Stremboxd.",
  "Enable Letterboxd integration": "Bật tích hợp Letterboxd",
  "Shows your Letterboxd catalogs on the home page and a Letterboxd panel on film pages.":
    "Hiển thị các danh mục Letterboxd trên trang chủ và bảng Letterboxd trên trang phim.",
  Mode: "Chế độ",
  Public: "Công khai",
  Full: "Đầy đủ",
  "Public mode uses just your username: watchlist, liked films, popular and Top 250. No password needed.":
    "Chế độ công khai chỉ sử dụng tên người dùng của bạn: danh sách xem, phim đã thích, phim phổ biến và Top 250. Không cần mật khẩu.",
  "Full mode signs in with your Letterboxd password to also unlock your diary, friends activity and your personal ratings. Your password is sent only to Stremboxd to obtain a token — Harbor never stores it.":
    "Chế độ đầy đủ đăng nhập bằng mật khẩu Letterboxd để mở khóa thêm nhật ký, hoạt động của bạn bè và điểm đánh giá cá nhân. Mật khẩu chỉ được gửi đến Stremboxd để lấy mã thông báo - Harbor không bao giờ lưu mật khẩu.",
  "Letterboxd username": "Tên người dùng Letterboxd",
  "Letterboxd password": "Mật khẩu Letterboxd",
  "Your Letterboxd password": "Mật khẩu Letterboxd của bạn",
  "Two-factor authentication code": "Mã xác thực hai yếu tố",
  "Connect / Verify": "Kết nối / Xác minh",
  "Verify & connect": "Xác minh và kết nối",
  "About Stremboxd": "Giới thiệu về Stremboxd",
  "Connected — {n} catalogs available": "Đã kết nối - có {n} danh mục",
  "Full mode — diary, friends & ratings enabled":
    "Chế độ đầy đủ - đã bật nhật ký, bạn bè và điểm đánh giá",
  "Catalogs to show": "Danh mục hiển thị",
  "Custom lists": "Danh sách tùy chỉnh",
  "Remove list": "Xóa danh sách",
  "letterboxd.com/username/list/slug": "letterboxd.com/username/list/slug",
  "Show my rating on movie posters": "Hiển thị điểm đánh giá của tôi trên áp phích phim",
  "Overlays your Letterboxd rating on catalog posters (when available).":
    "Hiển thị điểm đánh giá Letterboxd của bạn trên áp phích trong danh mục (khi có).",
  "Blur reviews by default": "Mặc định làm mờ bài đánh giá",
  "Reviews on film pages are blurred until you reveal them.":
    "Bài đánh giá trên trang phim sẽ được làm mờ cho đến khi bạn hiển thị.",
  "Hidden catalogs": "Danh mục ẩn",
  Watchlist: "Danh sách xem",
  Diary: "Nhật ký",
  "Liked Films": "Phim đã thích",
  Friends: "Bạn bè",
  "Recommended for You": "Đề xuất cho bạn",
  "Popular This Week": "Phổ biến tuần này",
  "Top 250": "Top 250",
  "Could not resolve that Letterboxd list URL.": "Không thể nhận dạng URL danh sách Letterboxd đó.",
  "Choose an avatar": "Chọn ảnh đại diện",
  "{n} avatars across film, TV, and anime.": "{n} ảnh đại diện từ phim điện ảnh, phim bộ và anime.",
  "Rights and usage": "Quyền và cách sử dụng",
  "Fan-made avatars for personal use. Harbor claims no rights to these characters; they belong to their creators and studios, shown here under fair use. Every one is optimized down to a tiny WebP.":
    "Ảnh đại diện do người hâm mộ tạo, dành cho mục đích sử dụng cá nhân. Harbor không tuyên bố quyền sở hữu các nhân vật này; họ thuộc về tác giả và hãng phim tương ứng, được hiển thị tại đây theo nguyên tắc sử dụng hợp lý. Mỗi ảnh đều được tối ưu thành tệp WebP dung lượng cực nhỏ.",
  "or use one of our avatars": "hoặc dùng một trong các ảnh đại diện của chúng tôi",
  "Random avatar": "Ảnh đại diện ngẫu nhiên",
  "More soon": "Sắp có thêm",
  "More avatars coming soon": "Sắp có thêm ảnh đại diện",
  "Scroll left": "Cuộn sang trái",
  "Scroll right": "Cuộn sang phải",
  Preview: "Xem trước",
  "Hover to peek": "Di chuột để xem nhanh",
  Merged: "Gộp",
  "Every row": "Mọi hàng",
  Trending: "Thịnh hành",
  Popular: "Phổ biến",
  "Trending · Cinemeta": "Thịnh hành · Cinemeta",
  "Popular · AIO": "Phổ biến · AIO",
  "On: addon rails that duplicate the built-ins show too, instead of folding into one.":
    "Bật: các hàng tiện ích bổ sung trùng với hàng có sẵn vẫn được hiển thị riêng thay vì gộp thành một.",
  auto: "tự động",
  "On: only titles you bookmarked. Off: also keeps the ones Stremio added when you hit play.":
    "Bật: chỉ giữ các tựa phim bạn đã đánh dấu. Tắt: giữ cả những tựa phim Stremio thêm khi bạn nhấn phát.",
  "Adds a Playlists tab to the nav for your M3U and Xtream libraries.":
    "Thêm thẻ Danh sách phát vào thanh điều hướng cho các thư viện M3U và Xtream.",
  "Home · Continue Watching": "Trang chủ · Xem tiếp",
  anime: "anime",
  "Anime tab": "Thẻ Anime",
  "Anime leaves Home Continue Watching and stays in the Anime tab's own row.":
    "Anime sẽ không xuất hiện trong mục Xem tiếp ở Trang chủ mà chỉ nằm trong hàng riêng của thẻ Anime.",
  "0m left": "còn 0 phút",
  "24m": "24 phút",
  "Finish an episode and the card jumps to the next one instead of sitting at 0m left.":
    "Xem xong một tập, thẻ sẽ chuyển sang tập tiếp theo thay vì dừng ở mốc còn 0 phút.",
  "Movies you've finished and shows in progress leave the catalog rows. Continue Watching is never touched.":
    "Phim lẻ đã xem xong và phim bộ đang xem dở sẽ không còn xuất hiện trong các hàng danh mục. Tiếp tục xem không bị ảnh hưởng.",
  "No filter. Home shows every language.": "Không lọc. Trang chủ hiển thị mọi ngôn ngữ.",
  "language. Home filters to it.": "ngôn ngữ. Trang chủ lọc theo ngôn ngữ này.",
  "languages. Home filters to these.": "ngôn ngữ. Trang chủ lọc theo các ngôn ngữ này.",
  Tamil: "Tiếng Tamil",
  "Each episode shows its IMDb rating, right on the still.":
    "Điểm IMDb của từng tập hiển thị ngay trên ảnh tập phim.",
  "Turn on to show each episode's synopsis under the still.":
    "Bật để hiển thị tóm tắt của từng tập bên dưới ảnh tập phim.",
  "Loads full-resolution artwork instead of the lighter, softer version.":
    "Tải hình ảnh ở độ phân giải đầy đủ thay vì phiên bản nhẹ hơn, ít sắc nét hơn.",
  "Lighter (w300)": "Nhẹ hơn (w300)",
  Original: "Gốc",
  "Saved frame": "Khung hình đã lưu",
  "AI search": "Tìm kiếm bằng AI",
  "Type what you want in plain language and let a model find it. Bring your own OpenRouter key.":
    "Nhập nội dung bạn muốn bằng ngôn ngữ tự nhiên và để mô hình tìm kiếm. Sử dụng khóa OpenRouter của riêng bạn.",
  Model: "Mô hình",
  "Choose a model": "Chọn mô hình",
  "What gets through": "Nội dung được cho qua",
  "No filtering": "Không lọc",
  blocked: "bị chặn",
  shown: "được hiển thị",
  "Likely cam": "Có thể là bản quay lén",
  "Wrong year": "Sai năm",
  "Size outlier": "Kích thước bất thường",
  "Suspicious file": "Tệp đáng ngờ",
  "Top pick": "Lựa chọn hàng đầu",
  "All sources": "Tất cả nguồn",
  Play: "Phát",
  "When a flagged ad plays, a Skip button slides in so you jump straight past it.":
    "Khi phát quảng cáo bị gắn cờ, nút Bỏ qua sẽ trượt vào để bạn chuyển thẳng qua quảng cáo.",
  "Picks up right where you left off": "Tiếp tục ngay từ chỗ bạn dừng",
  "Back out mid-episode and the card keeps the exact frame you stopped on, with your progress, so it looks like a pause instead of a thumbnail.":
    "Thoát khi đang xem dở một tập, thẻ sẽ giữ nguyên khung hình nơi bạn dừng cùng tiến độ xem, trông như đang tạm dừng thay vì chỉ là ảnh thu nhỏ.",
  "The Last Stand": "Trận chiến cuối cùng",
  "With the city surrounded, an unlikely alliance forms as a long-buried secret finally comes to light.":
    "Khi thành phố bị bao vây, một liên minh không ai ngờ tới được hình thành và bí mật bị chôn giấu từ lâu cuối cùng cũng hé lộ.",
  "No Way Out": "Không lối thoát",
  "Loyalties shatter as the survivors realize the enemy has been among them all along.":
    "Lòng trung thành tan vỡ khi những người sống sót nhận ra kẻ thù vẫn luôn ở giữa họ.",
  "Previous frame": "Khung hình trước",
  "Next frame": "Khung hình tiếp theo",
  "Step back one frame and pause. Frame-accurate on mpv.":
    "Lùi một khung hình rồi tạm dừng. Chính xác đến từng khung hình trên mpv.",
  "Step forward one frame and pause. Frame-accurate on mpv.":
    "Tiến một khung hình rồi tạm dừng. Chính xác đến từng khung hình trên mpv.",
};

export default settings;
