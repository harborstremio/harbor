const settingsFill: Record<string, string> = {
  "Your avatar, name, and handle across Harbor.":
    "Ảnh đại diện, tên và tên người dùng của bạn trên Harbor.",
  'Adds an "Ask AI" button to search, so you can type things like a plain-language request.':
    'Thêm nút "Hỏi AI" vào phần tìm kiếm để bạn có thể nhập yêu cầu bằng ngôn ngữ tự nhiên.',
  "Get a key at": "Lấy khóa tại",
  "It only runs when you tap that button, so it never costs anything unless you ask.":
    "Tính năng chỉ chạy khi bạn nhấn nút đó, nên sẽ không phát sinh chi phí trừ khi bạn yêu cầu.",
  "Groq runs open-source models on its LPU hardware with a generous free tier; every model listed below runs on the free tier.":
    "Groq chạy các mô hình nguồn mở trên phần cứng LPU với gói miễn phí có hạn mức cao; mọi mô hình liệt kê bên dưới đều dùng được trong gói miễn phí.",
  "Custom model id (optional)": "ID mô hình tùy chỉnh (không bắt buộc)",
  "Use model": "Dùng mô hình",
  "Any model id from console.groq.com/docs/models works here.":
    "Có thể dùng mọi ID mô hình từ console.groq.com/docs/models tại đây.",
  "Any model id from openrouter.ai/models works here, including :free variants.":
    "Có thể dùng mọi ID mô hình từ openrouter.ai/models tại đây, kể cả các biến thể :free.",
  "SVP's files are here but its VapourSynth engine won't load ({err}). This usually means a stale VapourSynth entry or a missing Microsoft VC++ runtime. Reinstall SVP, or install the latest \"Visual C++ Redistributable (x64)\" from Microsoft, then reopen Harbor.":
    'Các tệp của SVP đã có nhưng không thể tải công cụ VapourSynth ({err}). Nguyên nhân thường là mục VapourSynth đã lỗi thời hoặc thiếu Microsoft VC++ runtime. Hãy cài đặt lại SVP hoặc cài phiên bản "Visual C++ Redistributable (x64)" mới nhất từ Microsoft, rồi mở lại Harbor.',
  "Smooth motion runs on the bundled mpv engine in the Harbor desktop app. It has no effect in the browser.":
    "Chuyển động mượt chạy trên công cụ mpv tích hợp trong ứng dụng Harbor dành cho máy tính. Tính năng này không có tác dụng trong trình duyệt.",
  "Subtitle auto-sync": "Tự động đồng bộ phụ đề",
  "Harbor times out-of-sync subtitles to the audio for you, on any external subtitle. It works on the mpv player and leaves embedded tracks alone, since those are already in sync.":
    "Harbor tự căn thời gian của mọi phụ đề ngoài bị lệch theo âm thanh. Tính năng hoạt động trên trình phát mpv và không thay đổi các track nhúng vì chúng đã được đồng bộ.",
  "Auto-sync subtitles": "Tự động đồng bộ phụ đề",
  "When a subtitle runs early or late, Harbor measures the speech and corrects the timing on its own. Off by default.":
    "Khi phụ đề xuất hiện sớm hoặc muộn, Harbor sẽ phân tích lời thoại và tự điều chỉnh thời gian. Mặc định tắt.",
  "Let structural tiers auto-apply": "Cho phép tự động áp dụng các cấp cấu trúc",
  "Identity matches from content hashing and the community database always apply on their own. Timing worked out from the audio only offers a fix until it has earned trust. Turn this on to let those audio-derived fixes apply automatically too.":
    "Các kết quả khớp danh tính từ hàm băm nội dung và cơ sở dữ liệu cộng đồng luôn tự động được áp dụng. Căn thời gian chỉ dựa trên âm thanh chỉ đưa ra bản sửa tạm thời cho đến khi đủ độ tin cậy. Bật tùy chọn này để các bản sửa dựa trên âm thanh đó cũng tự động được áp dụng.",
  "Drift monitor": "Theo dõi độ lệch",
  "Keeps watching through playback and gently re-nudges the timing if the subtitle slips out of sync partway through.":
    "Liên tục theo dõi trong khi phát và nhẹ nhàng căn lại thời gian nếu phụ đề bị lệch đồng bộ giữa chừng.",
  "Smart resync with speech recognition": "Đồng bộ lại thông minh bằng nhận dạng giọng nói",
  "For the hardest files and the Try again button, Harbor transcribes a little speech on your device and lines the subtitle up to the actual words. Needs a build with the asr-whisper feature and downloads a small model the first time you use it.":
    "Với những tệp khó xử lý nhất và nút Thử lại, Harbor chép lời một đoạn hội thoại ngắn ngay trên thiết bị rồi căn phụ đề theo lời nói thực tế. Cần bản dựng có tính năng asr-whisper và sẽ tải xuống một mô hình nhỏ trong lần sử dụng đầu tiên.",
  "Community sync": "Đồng bộ cộng đồng",
  "A good correction only has to be found once. Harbor can share verified fixes so the next person with the same file and subtitle gets an instant result. Records are keyed by salted fingerprints, never your files or anything personal.":
    "Một bản sửa tốt chỉ cần được tìm ra một lần. Harbor có thể chia sẻ các bản sửa đã xác minh để người tiếp theo dùng cùng tệp và phụ đề nhận kết quả tức thì. Bản ghi được định danh bằng dấu vân tay đã thêm salt, tuyệt đối không dùng tệp hay thông tin cá nhân của bạn.",
  "Use community corrections": "Dùng bản sửa từ cộng đồng",
  "Check the shared database first. When this exact subtitle has already been synced by someone else, yours snaps into place with no analysis.":
    "Kiểm tra cơ sở dữ liệu dùng chung trước. Nếu phụ đề chính xác này đã được người khác đồng bộ, phụ đề của bạn sẽ khớp ngay mà không cần phân tích.",
  "Community sync server": "Máy chủ đồng bộ cộng đồng",
  "https://sync.harbor.site": "https://sync.harbor.site",
  "Leave blank to use Harbor's own community server. Enter a URL to point at your own server instead. Private mode below stops all contact either way.":
    "Để trống để dùng máy chủ cộng đồng của Harbor. Nhập URL nếu muốn dùng máy chủ riêng. Chế độ riêng tư bên dưới sẽ chặn mọi kết nối trong cả hai trường hợp.",
  "Private mode": "Chế độ riêng tư",
  "Never contact the community server in either direction. Nothing is looked up and nothing is contributed from this device.":
    "Không bao giờ liên hệ với máy chủ cộng đồng theo bất kỳ chiều nào. Thiết bị này sẽ không tra cứu hay đóng góp bất kỳ dữ liệu nào.",
  "Harbor ships a neutral trophy for every award. Install an icon pack or upload your own image per award to make them yours. Packs are hosted by whoever makes them, so the artwork is theirs, not bundled with Harbor.":
    "Harbor cung cấp biểu tượng cúp trung tính cho mọi giải thưởng. Cài đặt gói biểu tượng hoặc tải ảnh riêng lên cho từng giải để cá nhân hóa. Các gói do người tạo tự lưu trữ, vì vậy hình ảnh thuộc về họ và không được đóng gói cùng Harbor.",
  "View community award packs": "Xem các gói giải thưởng cộng đồng",
  "Icon packs and single-award art from the community":
    "Gói biểu tượng và hình ảnh cho từng giải thưởng từ cộng đồng",
  "Upload an image per award, or name your zip files after the ID shown under each one (tap to copy). Natural names work too, so best_soundtrack, movie_of_the_year, etc. still match.":
    "Tải lên một ảnh cho mỗi giải thưởng, hoặc đặt tên các tệp zip theo ID hiển thị bên dưới từng giải (chạm để sao chép). Tên tự nhiên cũng được hỗ trợ, nên best_soundtrack, movie_of_the_year, v.v. vẫn sẽ khớp.",
  "An award pack is a single JSON file plus the images it points to. Host both anywhere public (your own server, a GitHub repo, etc.) and share the JSON URL. Harbor only stores the URLs you install, never the images.":
    "Gói giải thưởng gồm một tệp JSON duy nhất cùng các ảnh mà tệp đó trỏ tới. Lưu trữ cả hai ở bất kỳ nơi công khai nào (máy chủ riêng, kho GitHub, v.v.) rồi chia sẻ URL của JSON. Harbor chỉ lưu các URL bạn cài đặt, không bao giờ lưu ảnh.",
  "Each key above is an award ID. Any key you omit falls back to the default trophy (or a lower-priority pack). The full list of IDs is every award shown in the grid above.":
    "Mỗi khóa bên trên là một ID giải thưởng. Khóa nào bị bỏ qua sẽ dùng cúp mặc định (hoặc gói có mức ưu tiên thấp hơn). Danh sách ID đầy đủ gồm mọi giải thưởng hiển thị trong lưới bên trên.",
  'Name each image file after its award ID and put them in a .zip, then use "Import a .zip pack" above. No JSON, no hosting needed. Harbor matches each file to its award, stores it locally, resizes it, and skips anything it doesn\'t recognize.':
    'Đặt tên từng tệp ảnh theo ID giải thưởng, cho chúng vào tệp .zip rồi dùng "Nhập gói .zip" bên trên. Không cần JSON hay dịch vụ lưu trữ. Harbor sẽ ghép từng tệp với giải thưởng tương ứng, lưu cục bộ, đổi kích thước và bỏ qua mọi tệp không nhận dạng được.',
  "Watched badge": "Huy hiệu đã xem",
  "How episodes are grouped for shows and anime. TVDB is the default: it gives the arc, DVD, and absolute orderings anime fans expect, with no key needed. TMDB keeps the plain aired order. Either way, every episode still plays and marks watched the same.":
    "Cách nhóm các tập của phim bộ và anime. TVDB là mặc định: cung cấp thứ tự theo mạch truyện, DVD và thứ tự tuyệt đối mà người hâm mộ anime mong đợi, không cần khóa. TMDB giữ nguyên thứ tự phát sóng thông thường. Dù chọn cách nào, mọi tập vẫn phát và được đánh dấu đã xem như nhau.",
  "Turns the season button into a full panel: order tabs (Aired, DVD, Absolute, and any the show has) plus a season table with air-date ranges and episode counts. On by default for anime through Harbor's TVDB service, no key needed. Add your own TVDB key to use it for regular shows too.":
    "Biến nút mùa thành một bảng đầy đủ: các thẻ thứ tự (Phát sóng, DVD, Tuyệt đối và mọi thứ tự mà phim có) cùng bảng mùa hiển thị khoảng ngày phát sóng và số tập. Được bật mặc định cho anime qua dịch vụ TVDB của Harbor, không cần khóa. Thêm khóa TVDB riêng để dùng cho phim bộ thông thường.",
  'When Esc would close the player, show a quick confirm first. You can tick "Don\'t ask me again" in that prompt to always leave on Esc.':
    'Khi Esc sắp đóng trình phát, trước tiên hãy hiện xác nhận nhanh. Bạn có thể chọn "Đừng hỏi lại" trong lời nhắc đó để Esc luôn thoát ngay.',
  "Short seek (Shift + arrows)": "Tua ngắn (Shift + phím mũi tên)",
  "A shorter jump on Shift plus the arrow keys, for nudging a few seconds at a time.":
    "Tua một quãng ngắn hơn bằng Shift kết hợp với các phím mũi tên để dịch chuyển vài giây mỗi lần.",
  'Posters, logos, and title art load in the first available language from this list, falling back down the order. "Original" uses the title\'s own language. Put your main language first. Needs a TMDB key.':
    'Poster, logo và ảnh tiêu đề sẽ tải bằng ngôn ngữ khả dụng đầu tiên trong danh sách này, rồi lần lượt chuyển xuống dưới nếu không có. "Nguyên bản" dùng ngôn ngữ gốc của tiêu đề. Hãy đặt ngôn ngữ chính của bạn lên đầu. Cần khóa TMDB.',
  "Keep Continue Watching private to each profile": "Giữ Tiếp tục xem riêng tư cho từng hồ sơ",
  "Only show Continue Watching for the profile that's active. Each profile sees just its own progress, so what you watch stays hidden from the other profiles that share this Stremio account.":
    "Chỉ hiển thị Tiếp tục xem cho hồ sơ đang hoạt động. Mỗi hồ sơ chỉ thấy tiến độ riêng, nên nội dung bạn xem sẽ được ẩn khỏi các hồ sơ khác dùng chung tài khoản Stremio này.",
  "Show pages": "Trang phim",
  "How a show or movie detail page behaves when you open it.":
    "Cách trang chi tiết phim bộ hoặc phim điện ảnh hoạt động khi bạn mở trang.",
  "When you reopen a show you were already browsing, jump straight back to your spot (usually the episode list) instead of starting at the top. The jump happens before the page shows, so there is no flash.":
    "Khi mở lại phim bộ đang xem dở, chuyển thẳng về vị trí trước đó (thường là danh sách tập) thay vì bắt đầu từ đầu trang. Việc chuyển vị trí diễn ra trước khi trang hiển thị nên sẽ không bị nháy.",
  "Hide and skip episodes": "Ẩn và bỏ qua tập",
  "Adds a Hide option when you right-click an episode. Hidden episodes disappear from the list and are skipped by Up Next. A Show hidden toggle on each show lets you bring them back.":
    "Thêm tùy chọn Ẩn khi bạn nhấp chuột phải vào một tập. Các tập đã ẩn sẽ biến mất khỏi danh sách và bị Tiếp theo bỏ qua. Nút bật tắt Hiện mục đã ẩn trên mỗi phim bộ cho phép hiển thị lại các tập đó.",
  "Poster shine on hover": "Hiệu ứng sáng poster khi di chuột",
  "A subtle tvOS style light sweep across a poster when you hover it. Off by default; the card lift stays either way.":
    "Hiệu ứng ánh sáng lướt nhẹ kiểu tvOS trên poster khi bạn di chuột qua. Mặc định tắt; hiệu ứng nâng thẻ vẫn luôn được giữ nguyên.",
  "Looking for Harbor in your browser, the phone remote, or the manga reader remote? They moved to the Remotes page.":
    "Bạn đang tìm Harbor trong trình duyệt, điều khiển từ xa trên điện thoại hoặc điều khiển từ xa cho trình đọc manga? Chúng đã được chuyển sang trang Điều khiển từ xa.",
  "X-Ray (experimental)": "X-Ray (thử nghiệm)",
  "Amazon-style X-Ray: open the cast while you watch and tap anyone for their bio and everything they have been in. On-device face matching to show who is on screen is coming next. Off by default.":
    "X-Ray kiểu Amazon: mở danh sách diễn viên khi đang xem và nhấn vào bất kỳ ai để xem tiểu sử cùng mọi tác phẩm họ từng tham gia. Tính năng đối chiếu khuôn mặt ngay trên thiết bị để cho biết ai đang xuất hiện trên màn hình sẽ sớm ra mắt. Mặc định tắt.",
  "Enable X-Ray": "Bật X-Ray",
  "Adds an X-Ray button in the player to see the full cast with photos and tap through to any actor. Needs a TMDB key for photos and filmographies.":
    "Thêm nút X-Ray vào trình phát để xem toàn bộ diễn viên kèm ảnh và nhấn để xem thông tin của bất kỳ diễn viên nào. Cần khóa TMDB để tải ảnh và danh sách phim đã tham gia.",
  "Scan who is on screen while playing": "Quét người đang xuất hiện trên màn hình khi phát",
  "Periodically match faces in the current frame against the cast to show who is on screen now. On-device, nothing leaves your machine. Uses a little more CPU while playing.":
    "Định kỳ đối chiếu khuôn mặt trong khung hình hiện tại với dàn diễn viên để cho biết ai đang xuất hiện trên màn hình. Mọi thứ diễn ra trên thiết bị, không có dữ liệu nào rời khỏi máy. Tốn thêm một chút CPU khi phát.",
  "X-Ray needs a TMDB key": "X-Ray cần khóa TMDB",
  "X-Ray reads the cast and their photos from TMDB. Without a TMDB key there is no cast to match against. Add your free key under Library & metadata.":
    "X-Ray lấy danh sách diễn viên và ảnh của họ từ TMDB. Nếu không có khóa TMDB, sẽ không có danh sách diễn viên để đối chiếu. Thêm khóa miễn phí trong Thư viện & siêu dữ liệu.",
  "Ask if you're still watching": "Hỏi xem bạn có còn đang xem không",
  "After several episodes auto-play in a row with no input, pause and check you're still there before continuing. Off by default.":
    "Sau khi tự động phát liên tiếp vài tập mà không có thao tác, tạm dừng và kiểm tra xem bạn có còn đang xem không trước khi tiếp tục. Mặc định tắt.",
  "After 2": "Sau 2 tập",
  "After 3": "Sau 3 tập",
  "After 4": "Sau 4 tập",
  "After 5": "Sau 5 tập",
  "Remotes are served by the desktop app. Open these settings on your computer's Harbor to get the links.":
    "Các điều khiển từ xa do ứng dụng máy tính cung cấp. Mở phần cài đặt này trong Harbor trên máy tính để lấy liên kết.",
  "Harbor on other devices": "Harbor trên thiết bị khác",
  "Serve Harbor on your network": "Cung cấp Harbor trên mạng của bạn",
  "One switch powers everything on this page: the web app, the phone remote, and the manga reader remote.":
    "Một công tắc bật mọi tính năng trên trang này: ứng dụng web, điều khiển từ xa bằng điện thoại và điều khiển từ xa cho trình đọc manga.",
  "Phone remote": "Điều khiển từ xa bằng điện thoại",
  "Turns your phone into a remote for this computer: play, pause, seek, volume, and casting, all from the couch. Open the Wi-Fi address on your phone's browser.":
    "Biến điện thoại thành điều khiển từ xa cho máy tính này: phát, tạm dừng, tua, chỉnh âm lượng và truyền nội dung, tất cả ngay từ ghế sofa. Mở địa chỉ Wi-Fi bằng trình duyệt trên điện thoại.",
  "Manga reader remote": "Điều khiển từ xa cho trình đọc manga",
  "Control the manga flipbook from your phone while reading on the big screen: turn pages, zoom, and switch modes. The reader also shows this link while you read.":
    "Điều khiển trình đọc manga dạng lật trang bằng điện thoại khi đọc trên màn hình lớn: lật trang, thu phóng và chuyển chế độ. Trình đọc cũng hiển thị liên kết này khi bạn đọc.",
  "Flip the switch above and the phone remote and manga reader remote addresses appear here.":
    "Bật công tắc phía trên để địa chỉ điều khiển từ xa bằng điện thoại và điều khiển từ xa cho trình đọc manga xuất hiện tại đây.",
  "On a beta that's giving you trouble? Pick an earlier build below and run its installer over your current copy. Your library, settings, and downloads all stay put.":
    "Bản beta đang gây lỗi? Chọn một bản dựng cũ hơn bên dưới rồi chạy trình cài đặt đè lên bản hiện tại. Thư viện, cài đặt và nội dung tải xuống vẫn được giữ nguyên.",
  "While beta updates are on, Harbor offers the newest build again on its next check. Turn beta updates off above to stay on an earlier one.":
    "Khi vẫn bật cập nhật beta, Harbor sẽ tiếp tục đề xuất bản dựng mới nhất ở lần kiểm tra tiếp theo. Tắt cập nhật beta ở trên để tiếp tục dùng bản cũ hơn.",
  "Picture shaders run on the bundled mpv engine in the Harbor desktop app. They have no effect in the browser.":
    "Shader hình ảnh chạy trên công cụ mpv tích hợp trong ứng dụng Harbor cho máy tính. Chúng không có tác dụng trong trình duyệt.",
  "Download the desktop app to use shaders.": "Tải ứng dụng máy tính để dùng shader.",
  "More picture shaders": "Thêm shader hình ảnh",
  "Neural upscalers, sharpeners, and HDR tone-mapping ported for mpv. Each is hosted by its author, not bundled with Harbor. Download the ones you want; Harbor chains them in the right order and applies them in the player.":
    "Các trình nâng cấp độ phân giải bằng mạng nơ-ron, tăng độ nét và ánh xạ tông màu HDR được chuyển sang mpv. Mỗi shader do tác giả lưu trữ, không được tích hợp vào Harbor. Hãy tải các shader bạn muốn; Harbor sẽ xâu chuỗi chúng theo đúng thứ tự và áp dụng trong trình phát.",
  Cleared: "Đã xóa",
  "Sure?": "Chắc chứ?",
  "Storage overview": "Tổng quan bộ nhớ",
  "Everything Harbor saves lives on this computer. If space runs low, clear a cache below; Harbor rebuilds them as you browse.":
    "Mọi dữ liệu Harbor lưu đều nằm trên máy tính này. Nếu sắp hết dung lượng, hãy xóa một bộ nhớ đệm bên dưới; Harbor sẽ tạo lại khi bạn duyệt nội dung.",
  "App storage": "Bộ nhớ ứng dụng",
  "{quota} available": "Còn trống {quota}",
  "Settings storage": "Bộ nhớ cài đặt",
  "Clear caches": "Xóa bộ nhớ đệm",
  "Safe to clear anytime. Nothing here touches your watch history, library, themes, or sign-ins.":
    "Có thể xóa an toàn bất cứ lúc nào. Thao tác này không ảnh hưởng đến lịch sử xem, thư viện, giao diện hoặc thông tin đăng nhập.",
  "Stream picker cache": "Bộ nhớ đệm trình chọn luồng",
  "Remembered source lists per title. Clears stale results after changing addons or debrid.":
    "Danh sách nguồn đã ghi nhớ theo từng tựa phim. Xóa các kết quả cũ sau khi thay đổi tiện ích bổ sung hoặc debrid.",
  "Manga browse cache": "Bộ nhớ đệm duyệt manga",
  "Cached chapter lists and browse pages. Downloads stay untouched.":
    "Danh sách chương và trang duyệt đã lưu vào bộ nhớ đệm. Nội dung tải xuống không bị ảnh hưởng.",
  "Live TV caches": "Bộ nhớ đệm TV trực tiếp",
  "Parsed playlists, program guide, and series info. Re-downloads on next open.":
    "Danh sách phát, lịch chương trình và thông tin phim bộ đã phân tích. Sẽ tải lại vào lần mở tiếp theo.",
  "Dead stream marks": "Dấu luồng hỏng",
  "Sources Harbor flagged as broken. Clear to give them another chance.":
    "Các nguồn bị Harbor đánh dấu là hỏng. Xóa để thử lại các nguồn này.",
  "Continue Watching suggestions cache": "Bộ nhớ đệm đề xuất Xem tiếp",
  "Resurface picks for the home rail. Rebuilds overnight.":
    "Đưa lại các nội dung đề xuất lên hàng nội dung trang chủ. Được tạo lại qua đêm.",
  "Downloaded themes are managed in Theme & appearance. Video and manga downloads are managed on the Downloads page.":
    "Giao diện đã tải xuống được quản lý trong Giao diện & hiển thị. Video và manga tải xuống được quản lý trên trang Tải xuống.",
  "Pattern (e.g. \\bremux\\b)": "Mẫu (ví dụ: \\bremux\\b)",
  "Downloaded from community": "Đã tải từ cộng đồng",
  "Badge art packs you installed from the community store. Remove one to put its badges back to default.":
    "Các gói hình huy hiệu bạn đã cài từ cửa hàng cộng đồng. Xóa một gói để đưa huy hiệu của gói đó về mặc định.",
  "{n} badges": "{n} huy hiệu",
  "Pack removed, badges back to default": "Đã xóa gói, huy hiệu đã trở về mặc định",
  "Remove pack": "Xóa gói",
  "View community badge packs": "Xem các gói huy hiệu cộng đồng",
  packs: "gói",
  "Any Stremio subtitle addons you have installed are searched here too.":
    "Mọi tiện ích bổ sung phụ đề Stremio bạn đã cài đặt cũng được tìm kiếm tại đây.",
  "{count} installed. Add or remove them under Streaming sources.":
    "Đã cài đặt {count}. Thêm hoặc xóa trong Nguồn phát trực tuyến.",
  "None installed yet. Add Stremio subtitle addons under Streaming sources.":
    "Chưa cài đặt tiện ích nào. Thêm tiện ích bổ sung phụ đề Stremio trong Nguồn phát trực tuyến.",
  "Subtitle sources": "Nguồn phụ đề",
  "Harbor searches every source you enable at the same time, then merges and de-duplicates the results into one clean list. Turn a source off to stop pulling from it.":
    "Harbor tìm kiếm đồng thời trong mọi nguồn bạn bật, sau đó hợp nhất và loại bỏ kết quả trùng lặp thành một danh sách gọn gàng. Tắt nguồn để ngừng lấy dữ liệu từ nguồn đó.",
  OpenSubtitles: "OpenSubtitles",
  "Harbor's built-in OpenSubtitles search, on by default. If you install an OpenSubtitles addon, this steps aside automatically so your results are never duplicated.":
    "Tính năng tìm kiếm OpenSubtitles tích hợp của Harbor, được bật theo mặc định. Nếu bạn cài đặt tiện ích bổ sung OpenSubtitles, tính năng này sẽ tự động nhường chỗ để kết quả không bao giờ bị trùng lặp.",
  Wyzie: "Wyzie",
  "A fast community subtitle index. Off by default; turn it on for extra coverage on newer or niche releases.":
    "Chỉ mục phụ đề cộng đồng tốc độ cao. Tắt theo mặc định; hãy bật để mở rộng phạm vi cho các bản phát hành mới hoặc kén người xem.",
  "Subtitle addons": "Tiện ích bổ sung phụ đề",
  SUBDL: "SUBDL",
  "A large multi-language subtitle database. Off until you add your free SUBDL API key.":
    "Cơ sở dữ liệu phụ đề đa ngôn ngữ quy mô lớn. Tắt cho đến khi bạn thêm khóa API SUBDL miễn phí.",
  "Paste your SUBDL API key": "Dán khóa API SUBDL của bạn",
  "Get a free key at subdl.com": "Nhận khóa miễn phí tại subdl.com",
  Subsource: "Subsource",
  "A community subtitle source. Off until you add your Subsource API key.":
    "Nguồn phụ đề cộng đồng. Tắt cho đến khi bạn thêm khóa API Subsource.",
  "Paste your Subsource API key": "Dán khóa API Subsource của bạn",
  "Get your key at subsource.net": "Nhận khóa tại subsource.net",
  "Manage subtitle addons in Streaming sources":
    "Quản lý tiện ích bổ sung phụ đề trong Nguồn phát trực tuyến",
  "The languages above all obey your preferred subtitle language order, which lives in the Languages page.":
    "Tất cả ngôn ngữ ở trên đều tuân theo thứ tự ngôn ngữ phụ đề ưu tiên của bạn, được thiết lập trên trang Ngôn ngữ.",
  "Open Languages": "Mở Ngôn ngữ",
  Maximum: "Tối đa",
  "Resolution posters are decoded at. High is sized to your screen with headroom and looks identical to full res while using far less memory; Balanced saves the most; Maximum keeps original resolution.":
    "Độ phân giải dùng để giải mã áp phích. Cao điều chỉnh theo màn hình với một khoảng dư và trông giống hệt độ phân giải đầy đủ nhưng dùng ít bộ nhớ hơn nhiều; Cân bằng tiết kiệm nhất; Tối đa giữ nguyên độ phân giải gốc.",
  "Poster dock magnification": "Phóng đại áp phích kiểu thanh Dock",
  "Gently magnify nearby posters as you move across a poster row, like a dock. Off by default.":
    "Phóng đại nhẹ các áp phích lân cận khi bạn di chuyển qua một hàng áp phích, giống như thanh Dock. Tắt theo mặc định.",
  "Liquid Glass": "Kính lỏng",
  "Use liquid glass": "Dùng kính lỏng",
  "Use liquid glass for the search pill and row scroll arrows. The appearance settings below are shared by glass surfaces across Harbor.":
    "Dùng kính lỏng cho ô tìm kiếm dạng viên thuốc và các mũi tên cuộn hàng. Các cài đặt giao diện bên dưới được dùng chung cho mọi bề mặt kính trong Harbor.",
  "Enhanced liquid glass": "Kính lỏng nâng cao",
  "A richer glass treatment. May look better while using more graphics resources.":
    "Hiệu ứng kính phong phú hơn. Có thể đẹp hơn nhưng dùng nhiều tài nguyên đồ họa hơn.",
  "Glass opacity": "Độ mờ đục của kính",
  "Glass blur": "Độ nhòe của kính",
  "Glass tint": "Màu phủ kính",
  "Featured source": "Nguồn nổi bật",
  "What fills the hero. Trending is a fresh top list from Harbor, refreshed through the day. Classic uses your own Home rows.":
    "Nội dung hiển thị trong vùng nổi bật. Thịnh hành là danh sách hàng đầu mới nhất từ Harbor, được cập nhật trong ngày. Cổ điển dùng các hàng Trang chủ của riêng bạn.",
  Classic: "Cổ điển",
  Screensaver: "Trình bảo vệ màn hình",
  "When Harbor sits idle in the foreground, it drifts through cinematic backdrops with a clock and what's trending. Any movement or key brings you back. Off by default.":
    "Khi Harbor không hoạt động ở màn hình trước, ứng dụng sẽ lần lượt hiển thị các phông nền điện ảnh cùng đồng hồ và nội dung thịnh hành. Bất kỳ thao tác di chuyển hoặc phím nào cũng sẽ đưa bạn trở lại. Tắt theo mặc định.",
  "Ambient screensaver": "Trình bảo vệ màn hình sống động",
  "Start after": "Bắt đầu sau",
  "3 min": "3 phút",
  "5 min": "5 phút",
  "10 min": "10 phút",
  "15 min": "15 phút",
  "Moving the window": "Di chuyển cửa sổ",
  "Choose where you can grab Harbor to drag it around your screen.":
    "Chọn vị trí bạn có thể nắm giữ Harbor để kéo ứng dụng quanh màn hình.",
  "Native-style hybrid bar": "Thanh kết hợp kiểu nguyên bản",
  "Turn off the native window title bar above to use Harbor's hybrid bar instead.":
    "Tắt thanh tiêu đề cửa sổ nguyên bản ở trên để dùng thanh kết hợp của Harbor.",
  "Tuck clean, native-looking window buttons into the top corner, with hover labels. On macOS they become traffic-light dots. Blends into Harbor while feeling like your system's own title bar.":
    "Đặt các nút cửa sổ gọn gàng, trông như nguyên bản vào góc trên cùng, kèm nhãn khi di chuột. Trên macOS, chúng trở thành các chấm đèn giao thông. Hòa vào Harbor nhưng vẫn mang cảm giác như thanh tiêu đề của chính hệ thống.",
  "Frost the top bar on scroll": "Làm mờ thanh trên cùng khi cuộn",
  "As you scroll, the top bar frosts over the content beneath it. Off by default; it uses a blur, so leave it off on lower-end machines.":
    "Khi bạn cuộn, thanh trên cùng sẽ phủ hiệu ứng kính mờ lên nội dung bên dưới. Tắt theo mặc định; tính năng này dùng hiệu ứng làm nhòe, vì vậy nên tắt trên máy cấu hình thấp.",
  "Top-right controls": "Điều khiển góc trên bên phải",
  "The operating system draws native window controls, so Harbor cannot change their appearance.":
    "Hệ điều hành hiển thị các nút điều khiển cửa sổ nguyên bản nên Harbor không thể thay đổi giao diện của chúng.",
  "Choose how Watch Together and the minimize, maximize, and close buttons look. Liquid glass replaces the clean transparent controls.":
    "Chọn giao diện cho Xem cùng nhau và các nút thu nhỏ, phóng to, đóng. Kính lỏng thay thế các nút điều khiển trong suốt, tối giản.",
  "Clean transparent": "Trong suốt gọn gàng",
  "Liquid glass": "Kính lỏng",
  Filled: "Tô đầy",
  "Drag the window from anywhere": "Kéo cửa sổ từ bất kỳ đâu",
  "Move Harbor by dragging any empty space on a page, not just the top bar. Leave this off to keep clicks inside pages from nudging the window.":
    "Di chuyển Harbor bằng cách kéo bất kỳ vùng trống nào trên trang, không chỉ thanh trên cùng. Tắt tùy chọn này để thao tác nhấp trong trang không làm cửa sổ xê dịch.",
  "Stream priority": "Ưu tiên luồng phát",
  "Results from addons higher in this list come first. If one finds nothing, the next fills in.":
    "Kết quả từ các tiện ích bổ sung ở vị trí cao hơn trong danh sách này sẽ xuất hiện trước. Nếu một tiện ích không tìm thấy gì, tiện ích tiếp theo sẽ bổ sung.",
  "Following addon order": "Theo thứ tự tiện ích bổ sung",
  "Use addon order": "Dùng thứ tự tiện ích bổ sung",
  "Not installed": "Chưa cài đặt",
  "Priority applies once you have two or more stream addons.":
    "Tính năng ưu tiên áp dụng khi có ít nhất hai tiện ích bổ sung cung cấp luồng phát.",
  "{n} addons don't provide streams and aren't listed.":
    "{n} tiện ích bổ sung không cung cấp luồng phát nên không có trong danh sách.",
  "Moved {name} to position {n} of {total}": "Đã chuyển {name} đến vị trí {n} trên {total}",
  "Harbor ranking puts the best-scoring sources first. Addon order keeps each addon's results in the order it returned them, like the Stremio and Vidi apps. Stream priority below decides which addon leads, in both modes.":
    "Cách xếp hạng của Harbor đưa các nguồn có điểm cao nhất lên trước. Thứ tự tiện ích bổ sung giữ nguyên thứ tự kết quả do từng tiện ích trả về, giống như ứng dụng Stremio và Vidi. Mục ưu tiên luồng phát bên dưới quyết định tiện ích nào đứng đầu trong cả hai chế độ.",
  "If a stream hasn't started playing in time (a dead source or an addon that's down), automatically try the next available stream. Off by default.":
    "Nếu luồng phát không bắt đầu kịp thời (nguồn không hoạt động hoặc tiện ích bổ sung gặp sự cố), tự động thử luồng phát khả dụng tiếp theo. Mặc định tắt.",
  "How long to wait first": "Thời gian chờ ban đầu",
  "Slow addons and P2P sources often need more than 10 seconds to start. Raise this if streams are being skipped before they get a fair chance.":
    "Các tiện ích bổ sung chậm và nguồn P2P thường cần hơn 10 giây để bắt đầu. Hãy tăng thời gian này nếu luồng phát bị bỏ qua trước khi có đủ thời gian kết nối.",
  "{n} sec": "{n} giây",
  "Only start the torrent engine when needed": "Chỉ khởi động công cụ torrent khi cần",
  "Harbor normally starts its torrent engine at launch so the first P2P stream connects faster. That keeps a DHT node running and talking to the network even when you are not watching anything. Turn this on if you are on a metered or limited connection: the engine then starts the first time you actually play a torrent. Takes effect next launch.":
    "Harbor thường khởi động công cụ torrent ngay khi mở ứng dụng để luồng P2P đầu tiên kết nối nhanh hơn. Việc này duy trì một nút DHT hoạt động và giao tiếp với mạng ngay cả khi bạn không xem gì. Bật tùy chọn này nếu đang dùng kết nối tính phí theo lưu lượng hoặc bị giới hạn: khi đó công cụ chỉ khởi động khi bạn thực sự phát torrent lần đầu. Có hiệu lực từ lần khởi động tiếp theo.",
  "What fullscreen does": "Chế độ toàn màn hình hoạt động thế nào",
  "True fullscreen covers the whole screen and hides the taskbar. Maximize fills the screen but keeps the taskbar and title bar, so you can still switch apps.":
    "Toàn màn hình thực sự phủ kín toàn bộ màn hình và ẩn thanh tác vụ. Phóng to lấp đầy màn hình nhưng vẫn giữ thanh tác vụ và thanh tiêu đề để bạn vẫn có thể chuyển ứng dụng.",
  "True fullscreen": "Toàn màn hình thực sự",
  Maximize: "Phóng to",
  "Dual subtitles": "Phụ đề kép",
  "Show a second subtitle in another language at the same time. Handy when you are learning a language: keep the one you are learning as your main subtitle, and put your own language here.":
    "Hiển thị đồng thời phụ đề thứ hai bằng ngôn ngữ khác. Hữu ích khi học ngoại ngữ: đặt ngôn ngữ đang học làm phụ đề chính và chọn ngôn ngữ của bạn tại đây.",
  "Second subtitle language": "Ngôn ngữ phụ đề thứ hai",
  "Harbor loads it automatically when a track in that language exists. You can also set or clear the second track for one video from the subtitle menu in the player.":
    "Harbor tự động tải phụ đề này khi có bản phụ đề bằng ngôn ngữ đó. Bạn cũng có thể đặt hoặc xóa phụ đề thứ hai cho từng video trong menu phụ đề của trình phát.",
  "Where it shows": "Vị trí hiển thị",
  "Top of the screen": "Đầu màn hình",
  "Above the main line": "Phía trên dòng chính",
  "Second line size": "Kích thước dòng thứ hai",
  "Get your own": "Dùng gói riêng",
  "Trial for ${n}": "Dùng thử với giá ${n}",
  ElfHosted: "ElfHosted",
  "Debridge is the part that finds you a working file. A TorBox and a Usenet account come with it, so you do not need to buy a debrid service separately. Already have Real-Debrid or AllDebrid? Plug it in instead.":
    "Debridge là thành phần tìm tệp hoạt động cho bạn. Gói này đi kèm tài khoản TorBox và Usenet, nên bạn không cần mua riêng dịch vụ debrid. Đã có Real-Debrid hoặc AllDebrid? Hãy kết nối dịch vụ đó để dùng thay thế.",
  "No Docker, no server, nothing to configure.":
    "Không cần Docker, không cần máy chủ, không cần cấu hình.",
  "${n} for {days} days": "${n} cho {days} ngày",
  "cancel anytime": "hủy bất cứ lúc nào",
  "Rather not set any of this up?": "Không muốn tự thiết lập tất cả những thứ này?",
  "Get {name} hosted, plus {n} more addons.":
    "Dùng {name} được lưu trữ sẵn cùng thêm {n} tiện ích bổ sung.",
  "{n} addons run for you, with Debridge included: TorBox and Usenet accounts, so there is no debrid service to buy separately.":
    "{n} tiện ích bổ sung được vận hành sẵn cho bạn, kèm Debridge: tài khoản TorBox và Usenet, nên không cần mua riêng dịch vụ debrid.",
  "Try it for ${n}": "Dùng thử với giá ${n}",
  "Hide this": "Ẩn mục này",
  "Includes Comet, MediaFusion, AIOStreams, StremThru, Jackettio and more, plus TorBox and Usenet accounts. No Docker, no server, no config.":
    "Bao gồm Comet, MediaFusion, AIOStreams, StremThru, Jackettio và nhiều tiện ích khác, cùng tài khoản TorBox và Usenet. Không cần Docker, máy chủ hay cấu hình.",
  "Support Harbor": "Hỗ trợ Harbor",
  "Who keeps this running": "Ai duy trì dịch vụ này",
  "Harbor's backend runs on ElfHosted. They took it on without being asked, and Harbor has never charged for anything.":
    "Hệ thống backend của Harbor chạy trên ElfHosted. Họ đã chủ động đảm nhận việc này mà không cần ai đề nghị, còn Harbor chưa bao giờ thu phí bất kỳ thứ gì.",
  "If you want to put money somewhere and you use Harbor, an ElfHosted subscription is the most useful place for it. You get a managed instance, and the servers Harbor depends on stay paid for.":
    "Nếu muốn đóng góp tài chính và đang dùng Harbor, đăng ký ElfHosted là cách hữu ích nhất. Bạn nhận được một phiên bản được quản lý, đồng thời chi phí cho các máy chủ mà Harbor phụ thuộc vào vẫn được duy trì.",
  "Browse ElfHosted": "Khám phá ElfHosted",
  "One-off donation": "Quyên góp một lần",
  "Donating to Harbor": "Quyên góp cho Harbor",
  "Short version: don't. Harbor takes no donations and no cut of anything on this page.":
    "Nói ngắn gọn: đừng. Harbor không nhận quyên góp và cũng không hưởng phần trăm từ bất kỳ thứ gì trên trang này.",
  "People have offered plenty of times and the answer has stayed no. If you were going to send something, send it to ElfHosted above so the infrastructure stays up, or to one of the charities below. Both do more good than paying me would.":
    "Nhiều người đã đề nghị không ít lần và câu trả lời vẫn luôn là không. Nếu định gửi tiền, hãy gửi cho ElfHosted ở trên để duy trì cơ sở hạ tầng, hoặc cho một trong các tổ chức từ thiện bên dưới. Cả hai lựa chọn đều có ích hơn việc trả tiền cho tôi.",
  "If you would rather give it away": "Nếu bạn muốn dành khoản đó để quyên góp",
  "No affiliation, no referral links, and Harbor gets nothing from these. They are just places where money goes further than it does here.":
    "Không liên kết, không có liên kết giới thiệu và Harbor không nhận được gì từ những tổ chức này. Đây chỉ là những nơi mà số tiền đóng góp tạo ra nhiều giá trị hơn ở đây.",
  "Insecticide-treated nets. One of the most cost-effective interventions measured.":
    "Màn tẩm thuốc diệt côn trùng. Một trong những biện pháp can thiệp hiệu quả nhất về chi phí từng được đánh giá.",
  "Cash straight to people living in extreme poverty, no strings.":
    "Trao tiền trực tiếp, vô điều kiện cho người sống trong cảnh nghèo cùng cực.",
  "Emergency medical care in crisis zones.": "Chăm sóc y tế khẩn cấp tại các vùng khủng hoảng.",
  "Keeps the web's memory alive. Harbor would be poorer without it.":
    "Gìn giữ ký ức của web. Harbor sẽ thiếu thốn hơn nếu không có tổ chức này.",
  "Who pays for the servers, and where to put money if you want to.":
    "Ai chi trả cho máy chủ và nên đóng góp vào đâu nếu bạn muốn.",
  "Harbor's backend runs on ElfHosted. They run our servers at no cost to the community.":
    "Backend của Harbor chạy trên ElfHosted. Họ vận hành máy chủ của chúng tôi miễn phí cho cộng đồng.",
  "Keeping Harbor's backend online costs real money, and ElfHosted covers it so the community does not have to. Becoming a subscriber is the best way to keep that going, and it is not a donation. You get proper infrastructure for your own setup, and Harbor stays funded at the same time.":
    "Việc duy trì backend của Harbor trực tuyến thực sự tốn kém, và ElfHosted chi trả để cộng đồng không phải gánh khoản này. Đăng ký thuê bao là cách tốt nhất để duy trì điều đó, và đây không phải khoản quyên góp. Bạn có được hạ tầng phù hợp cho thiết lập riêng, đồng thời Harbor tiếp tục có kinh phí hoạt động.",
  "Private Stremio add-ons with 10x the rate limits and built-in stream proxying, from $9 a month.":
    "Các tiện ích bổ sung Stremio riêng tư với giới hạn tốc độ gấp 10 lần và proxy luồng tích hợp, từ $9 mỗi tháng.",
  "Managed Plex, Emby, or Jellyfin, running in minutes with no hardware and no Docker.":
    "Plex, Emby hoặc Jellyfin được quản lý, chạy chỉ sau vài phút mà không cần phần cứng hay Docker.",
  "Over 100 self-hosted apps: the *arr stack, debrid tools, books and audiobooks, and more.":
    "Hơn 100 ứng dụng tự lưu trữ: bộ *arr, công cụ debrid, sách, sách nói và nhiều nội dung khác.",
  "Daily backups, automatic updates, and monitoring, all handled for you.":
    "Sao lưu hằng ngày, cập nhật tự động và giám sát, tất cả đều được xử lý cho bạn.",
  "Month to month, cancel anytime, and you can try the whole thing for $1 for a week.":
    "Thanh toán theo tháng, hủy bất cứ lúc nào và dùng thử toàn bộ trong một tuần với giá $1.",
  "See what you get": "Xem quyền lợi",
  "Short version: don't. Harbor takes no donations.":
    "Nói ngắn gọn: đừng. Harbor không nhận quyên góp.",
  "If you were going to send something, send it to ElfHosted above so the servers stay paid for, or to one of the charities below. Both do more good with it.":
    "Nếu định gửi tiền, hãy gửi cho ElfHosted ở trên để duy trì kinh phí máy chủ, hoặc cho một trong các tổ chức từ thiện bên dưới. Cả hai lựa chọn đều giúp số tiền đó tạo ra nhiều giá trị hơn.",
  "Badges for giving": "Huy hiệu đóng góp",
  "Give to any charity below or subscribe to ElfHosted, and the badge lands on your profile.":
    "Quyên góp cho bất kỳ tổ chức từ thiện nào bên dưới hoặc đăng ký ElfHosted để nhận huy hiệu trên hồ sơ.",
  Charity: "Từ thiện",
  "For donating to a charity.": "Dành cho người quyên góp cho tổ chức từ thiện.",
  "Charity $100+": "Từ thiện $100+",
  "For giving more than $100 to charity.":
    "Dành cho người quyên góp hơn $100 cho tổ chức từ thiện.",
  "For an active ElfHosted subscription.": "Dành cho thuê bao ElfHosted đang hoạt động.",
  "To get a Charity badge, forward your donation receipt or invoice to":
    "Để nhận huy hiệu Từ thiện, hãy chuyển tiếp biên nhận quyên góp hoặc hóa đơn đến",
  "with your @handle in the body so we can match it to your account.":
    "kèm @handle của bạn trong nội dung để chúng tôi đối chiếu với tài khoản.",
  "Childhood cancer research and treatment. Families are never billed for care, travel, housing, or food.":
    "Nghiên cứu và điều trị ung thư ở trẻ em. Các gia đình không bao giờ phải trả chi phí chăm sóc, đi lại, chỗ ở hay ăn uống.",
  "Funds research into less toxic, more targeted treatments for childhood cancer.":
    "Tài trợ nghiên cứu các phương pháp điều trị ung thư trẻ em ít độc hại và nhắm đích chính xác hơn.",
  "Defends privacy, free expression, and the open internet, in the courts and in the code.":
    "Bảo vệ quyền riêng tư, quyền tự do biểu đạt và internet mở, cả trước tòa lẫn trong mã nguồn.",
  "Emergency medical care in crisis zones, independent of politics.":
    "Chăm sóc y tế khẩn cấp tại các vùng khủng hoảng, độc lập với chính trị.",
  "Look any of them up on Charity Navigator": "Tra cứu bất kỳ tổ chức nào trên Charity Navigator",
  "Built on Stremio": "Xây dựng trên Stremio",
  "Harbor would not be possible without Stremio. It is the foundation everything here is built on.":
    "Harbor sẽ không thể tồn tại nếu thiếu Stremio. Đây là nền tảng của mọi thứ được xây dựng tại đây.",
  "Harbor speaks Stremio's addon protocol, and the whole ecosystem of addons grows out of their work. Stremio is funded by its community, and supporters who chip in get early access to experimental features. If you have it to spare, send some their way too.":
    "Harbor sử dụng giao thức tiện ích bổ sung của Stremio, và toàn bộ hệ sinh thái tiện ích bổ sung phát triển từ công trình của họ. Stremio được cộng đồng tài trợ, còn những người ủng hộ đóng góp sẽ được truy cập sớm các tính năng thử nghiệm. Nếu có khả năng, hãy ủng hộ họ một phần.",
  "Support Stremio": "Ủng hộ Stremio",
  "Stremio Supporters get a special badge on their Harbor profile.":
    "Người ủng hộ Stremio nhận được huy hiệu đặc biệt trên hồ sơ Harbor.",
  "Your own private {name}, bundled with Debridge": "{name} riêng tư của bạn, đi kèm Debridge",
  "Who keeps the lights on, what Harbor is built on, and where to put money if you want to.":
    "Ai duy trì hệ thống hoạt động, Harbor được xây dựng trên nền tảng nào và nên đóng góp vào đâu nếu bạn muốn.",
  "If you were going to send something, send it to ElfHosted or Stremio above, or to one of the charities below. They all do more good with it.":
    "Nếu định gửi tiền, hãy gửi cho ElfHosted hoặc Stremio ở trên, hoặc cho một trong các tổ chức từ thiện bên dưới. Tất cả đều giúp số tiền đó tạo ra nhiều giá trị hơn.",
  "Support ElfHosted or Stremio, or give to any charity below, and the badge lands on your profile.":
    "Ủng hộ ElfHosted hoặc Stremio, hoặc quyên góp cho bất kỳ tổ chức từ thiện nào bên dưới để nhận huy hiệu trên hồ sơ.",
  "Fullscreen clock": "Đồng hồ toàn màn hình",
  "Keep your local time visible during fullscreen playback and choose how it looks.":
    "Luôn hiển thị giờ địa phương khi phát toàn màn hình và chọn kiểu hiển thị.",
  "Show fullscreen clock": "Hiển thị đồng hồ toàn màn hình",
  "The clock appears with the player controls.":
    "Đồng hồ xuất hiện cùng các nút điều khiển trình phát.",
  "Clock format": "Định dạng đồng hồ",
  "12-hour": "12 giờ",
  "24-hour": "24 giờ",
  "Show seconds": "Hiển thị giây",
  "Update the clock every second.": "Cập nhật đồng hồ mỗi giây.",
  "Show estimated finish time": "Hiển thị giờ kết thúc dự kiến",
  "Display the local time when the current video is expected to end.":
    "Hiển thị giờ địa phương dự kiến video hiện tại sẽ kết thúc.",
  "Clock size": "Kích thước đồng hồ",
  "Clock style": "Kiểu đồng hồ",
  Minimal: "Tối giản",
  Solid: "Đặc",
  Accent: "Màu nhấn",
  "Soft blur with a floating pill.": "Làm mờ nhẹ với nút nổi dạng viên thuốc.",
  "Time only, with a subtle shadow.": "Chỉ hiển thị thời gian, kèm bóng đổ nhẹ.",
  "High-contrast panel for busy scenes.": "Bảng tương phản cao cho các cảnh nhiều chi tiết.",
  "Uses your theme's accent color.": "Dùng màu nhấn của chủ đề.",
  "Focused Card": "Thẻ được chọn",
  "Expanding Cards": "Thẻ mở rộng",
  "Emphasize the selected card across the page while gently darkening and blurring the other cards.":
    "Làm nổi bật thẻ được chọn trên toàn trang, đồng thời làm tối và làm mờ nhẹ các thẻ khác.",
  "Expand poster cards during keyboard or remote navigation across poster rows, using preloaded wide artwork.":
    "Mở rộng thẻ áp phích khi điều hướng bằng bàn phím hoặc điều khiển từ xa qua các hàng áp phích, sử dụng ảnh ngang đã tải trước.",
  "Add a TMDB key in Settings to identify the cast.":
    "Thêm khóa TMDB trong Cài đặt để nhận diện diễn viên.",
  "No cast photos are available for this title.": "Không có ảnh diễn viên cho nội dung này.",
  "Accounts and TMDB": "Tài khoản và TMDB",
  "Add an M3U link or Xtream Codes login":
    "Thêm liên kết M3U hoặc thông tin đăng nhập Xtream Codes",
  "Add playlist": "Thêm danh sách phát",
  "Artwork, rows and collections": "Hình ảnh, hàng và bộ sưu tập",
  "Checking with TMDB…": "Đang kiểm tra với TMDB…",
  "Connected: {list}": "Đã kết nối: {list}",
  "Could not reach TMDB. Check the connection.":
    "Không thể kết nối với TMDB. Hãy kiểm tra kết nối.",
  "Edge margin": "Lề màn hình",
  "Finish setting up Harbor": "Hoàn tất thiết lập Harbor",
  "Get one free at {url}": "Nhận miễn phí tại {url}",
  "Getting a code ready…": "Đang chuẩn bị mã…",
  Harbor: "Harbor",
  "Harbor needs a TMDB key for artwork, rows and collections. It is free.":
    "Harbor cần khóa TMDB để tải hình ảnh, hàng và bộ sưu tập. Khóa này miễn phí.",
  "Harbor plays IPTV from your own provider. Add a playlist and the guide fills in.":
    "Harbor phát IPTV từ nhà cung cấp của bạn. Thêm danh sách phát để tự động điền lịch chương trình.",
  Interface: "Giao diện",
  "Live TV playlists": "Danh sách phát TV trực tiếp",
  "Nothing connected yet. Scan a code with your phone.":
    "Chưa có kết nối nào. Hãy quét mã bằng điện thoại.",
  "Phone setup is off": "Thiết lập bằng điện thoại đang tắt",
  "Press OK on a field to type, or use the Harbor remote on your phone.":
    "Nhấn OK trên một trường để nhập hoặc dùng điều khiển Harbor trên điện thoại.",
  "Raise this only if your TV cuts off the edges of the picture.":
    "Chỉ tăng mục này nếu TV cắt mất các cạnh hình ảnh.",
  "Replace the saved key": "Thay khóa đã lưu",
  "Save key": "Lưu khóa",
  "Scan with your phone to sign in without typing on the remote.":
    "Quét bằng điện thoại để đăng nhập mà không cần nhập trên điều khiển từ xa.",
  Screen: "Màn hình",
  "Set up Live TV": "Thiết lập TV trực tiếp",
  Setup: "Thiết lập",
  "Setup QR code": "Mã QR thiết lập",
  "Signed in as {name}": "Đã đăng nhập với tên {name}",
  "Sync, themes and friends": "Đồng bộ, chủ đề và bạn bè",
  "TMDB API key": "Khóa API TMDB",
  "TMDB did not accept that key.": "TMDB không chấp nhận khóa đó.",
  "Turn on phone setup": "Bật thiết lập bằng điện thoại",
  "Type a key on this TV": "Nhập khóa trên TV này",
  "Your Stremio library": "Thư viện Stremio của bạn",
  "{count} added": "Đã thêm {count}",
  "Performance notice": "Lưu ý về hiệu năng",
  "Live face scanning loads on-device AI models and can significantly increase RAM, CPU, and GPU usage while playback is active. Turn it off if Harbor slows down or your device gets hot.":
    "Tính năng quét khuôn mặt trực tiếp tải các mô hình AI trên thiết bị và có thể làm tăng đáng kể mức sử dụng RAM, CPU và GPU trong khi phát. Hãy tắt tính năng này nếu Harbor chạy chậm hoặc thiết bị nóng lên.",
};

export default settingsFill;
