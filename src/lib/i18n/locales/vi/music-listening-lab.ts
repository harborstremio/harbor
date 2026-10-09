const musicListeningLab: Record<string, string> = {
  "music.lab.profiles": "Hồ sơ nghe",
  "music.lab.profilesHelp":
    "Lưu hiệu chỉnh cho từng tai nghe hoặc loa. Tải chỉ thay đổi bản nháp; giữ nguyên đầu ra và giới hạn âm lượng. Áp dụng để nghe.",
  "music.lab.profileName": "Tên hồ sơ",
  "music.lab.saveProfile": "Lưu bản nháp thành hồ sơ",
  "music.lab.selectProfile": "Chọn hồ sơ",
  "music.lab.loadProfile": "Tải vào bản nháp",
  "music.lab.delete": "Xóa",
  "music.lab.response": "Đáp ứng bộ cân bằng tính toán",
  "music.lab.curveHelp":
    "Đáp ứng EQ tại {rate} kHz, trước tiền khuếch đại. Nét liền: bản nháp. Nét đứt: cài đặt đã áp dụng. Đây là phép tính, không phải đo thiết bị.",
  "music.lab.strength": "Mức hiệu chỉnh",
  "music.lab.strengthHelp":
    "Điều chỉnh độ lợi peak và shelf. Bộ lọc thông và notch giữ nguyên hình dạng; 0% bỏ qua mọi bộ lọc tham số.",
  "music.lab.filter": "Bộ lọc",
  "music.lab.enabled": "Bật",
  "music.lab.peak": "Đỉnh",
  "music.lab.lowShelf": "Shelf thấp",
  "music.lab.highShelf": "Shelf cao",
  "music.lab.lowPass": "Thông thấp",
  "music.lab.highPass": "Thông cao",
  "music.lab.notch": "Chặn dải hẹp",
  "music.lab.addFilter": "Thêm bộ lọc",
  "music.lab.headroomHelp":
    "Khoảng dự phòng tự động: {db} dB. Ước tính đỉnh tổng hợp với 0,5 dB dự trữ. Tiền khuếch đại dương có thể dùng hết phần dự trữ này.",
  "music.lab.importExport": "Nhập / xuất hiệu chỉnh",
  "music.lab.importHelp":
    "Dán văn bản bộ lọc Equalizer APO / AutoEQ. Hỗ trợ PK, LSC, HSC, LP, HP và NO có Q. Nhập dùng tiền khuếch đại của tệp và tắt dự phòng tự động. Xuất ghi mức hiệu chỉnh và dự phòng vào văn bản bên dưới.",
  "music.lab.correctionText": "Văn bản hiệu chỉnh",
  "music.lab.import": "Nhập vào bản nháp",
  "music.lab.export": "Tạo văn bản xuất",
  "music.lab.importError":
    "Hiệu chỉnh không hợp lệ hoặc không được hỗ trợ. Dùng 1–24 bộ lọc, 20–20.000 Hz, ±18 dB và Q 0,1–12. Không hỗ trợ lệnh xử lý khác.",
  "music.lab.preamp": "Tiền khuếch đại · dB",
  "music.lab.crossfeed": "Crossfeed tai nghe",
  "music.lab.crossfeedHelp":
    "Trộn một phần đã lọc của mỗi kênh stereo sang kênh kia để giảm tách biệt khi dùng tai nghe. 0% là tắt.",
  "music.lab.bypass": "Bỏ qua DSP Harbor",
  "music.lab.bypassHelp":
    "Sau khi áp dụng, bỏ qua EQ, tiền khuếch đại, crossfeed, cân bằng và ReplayGain. Đầu ra và âm lượng phát vẫn hoạt động. Không xác minh phát bit-perfect.",
  "music.lab.exclusive": "Yêu cầu đầu ra độc quyền",
  "music.lab.exclusiveHelp":
    "Đầu ra được hỗ trợ có thể bỏ qua bộ trộn hệ thống và chặn ứng dụng khác. Tùy trình điều khiển; công tắc này yêu cầu quyền truy cập, không xác nhận đã có quyền.",
  "music.lab.sampleRate": "Tần số lấy mẫu đầu ra",
  "music.lab.sourceRate": "Theo nguồn",
  "music.lab.rateHelp":
    "Không yêu cầu tần số cố định. Thiết bị có thể chọn tần số khác. Tần số cố định lấy mẫu lại khi cần; không khôi phục chi tiết mất do nén.",
  "music.lab.equalizer": "Bộ cân bằng",
  "music.lab.mode": "Chế độ cân bằng",
  "music.lab.parametric": "Tham số · tối đa 24 bộ lọc",
};
export default musicListeningLab;
