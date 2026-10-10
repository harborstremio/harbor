#ifndef _RAR_FILECREATE_
#define _RAR_FILECREATE_

enum FILECR_FLAGS
{
  FILECR_DEFAULT   = 0, // Default mode.
  FILECR_WRITEONLY = 1, // Create a file in write only mode.
  FILECR_FOLDER    = 2, // Delete the existing file, so caller can create a folder.
};

bool FileCreate(CommandData *Cmd,File *NewFile,std::wstring &Name,
                bool *UserReject,int64 FileSize=INT64NDF,
                RarTime *FileTime=nullptr,FILECR_FLAGS Flags=FILECR_DEFAULT);

#if defined(_WIN_ALL)
bool UpdateExistingShortName(const std::wstring &Name);
#endif

#endif
