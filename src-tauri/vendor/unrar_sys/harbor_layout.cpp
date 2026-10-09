// Compiled against the actual upstream header to verify the Rust FFI layout.
#include "vendor/unrar/rar.hpp"
#include <cstddef>
extern "C" size_t harbor_unrar_layout(unsigned int field) {
  const size_t values[] = {
    offsetof(RARHeaderDataEx, FileNameW),
    offsetof(RARHeaderDataEx, CmtBuf),
    offsetof(RARHeaderDataEx, DictSize),
    offsetof(RARHeaderDataEx, RedirType),
    offsetof(RARHeaderDataEx, AtimeHigh),
    offsetof(RAROpenArchiveDataEx, Callback),
    offsetof(RAROpenArchiveDataEx, UserData),
    offsetof(RAROpenArchiveDataEx, CmtBufW)
  };
  return field < sizeof(values) / sizeof(values[0]) ? values[field] : size_t(-1);
}
