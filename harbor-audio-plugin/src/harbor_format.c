#include "harbor_driver.h"

static const Float64 kHarborRates[] = {44100.0, 48000.0, 88200.0, 96000.0, 176400.0, 192000.0};

const Float64 *harbor_rates(UInt32 *outCount)
{
    if (outCount != NULL) {
        *outCount = (UInt32)(sizeof(kHarborRates) / sizeof(kHarborRates[0]));
    }
    return kHarborRates;
}

bool harbor_rate_supported(Float64 rate)
{
    UInt32 count = 0;
    const Float64 *rates = harbor_rates(&count);
    for (UInt32 index = 0; index < count; index += 1) {
        if (rates[index] == rate) {
            return true;
        }
    }
    return false;
}

void harbor_fill_format(AudioStreamBasicDescription *outFormat, Float64 rate)
{
    if (outFormat == NULL) {
        return;
    }
    memset(outFormat, 0, sizeof(AudioStreamBasicDescription));
    outFormat->mSampleRate = rate;
    outFormat->mFormatID = kAudioFormatLinearPCM;
    outFormat->mFormatFlags = kAudioFormatFlagIsFloat | kAudioFormatFlagIsPacked;
    outFormat->mBytesPerPacket = kHarborBytesPerFrame;
    outFormat->mFramesPerPacket = 1;
    outFormat->mBytesPerFrame = kHarborBytesPerFrame;
    outFormat->mChannelsPerFrame = kHarborChannels;
    outFormat->mBitsPerChannel = kHarborBitsPerChannel;
}

Float64 harbor_host_ticks_per_frame(Float64 rate)
{
    static mach_timebase_info_data_t timebase = {0, 0};
    if (timebase.denom == 0) {
        mach_timebase_info(&timebase);
    }
    if (timebase.numer == 0 || timebase.denom == 0 || rate <= 0.0) {
        return 0.0;
    }
    Float64 ticksPerSecond = 1000000000.0 * (Float64)timebase.denom / (Float64)timebase.numer;
    return ticksPerSecond / rate;
}

UInt32 harbor_streams_in_scope(AudioObjectPropertyScope scope, AudioObjectID *outStreams)
{
    if (scope == kAudioObjectPropertyScopeInput) {
        if (outStreams != NULL) {
            outStreams[0] = kHarborInputStreamID;
        }
        return 1;
    }
    if (scope == kAudioObjectPropertyScopeOutput) {
        if (outStreams != NULL) {
            outStreams[0] = kHarborOutputStreamID;
        }
        return 1;
    }
    if (outStreams != NULL) {
        outStreams[0] = kHarborInputStreamID;
        outStreams[1] = kHarborOutputStreamID;
    }
    return 2;
}

OSStatus harbor_request_rate(Float64 rate)
{
    if (!harbor_rate_supported(rate)) {
        return kAudioHardwareIllegalOperationError;
    }
    pthread_mutex_lock(&gHarbor.lock);
    Float64 current = gHarbor.sampleRate;
    AudioServerPlugInHostRef host = gHarbor.host;
    pthread_mutex_unlock(&gHarbor.lock);
    if (current == rate) {
        return kAudioHardwareNoError;
    }
    if (host == NULL) {
        return kAudioHardwareNotRunningError;
    }
    return host->RequestDeviceConfigurationChange(host, kHarborDeviceObjectID, (UInt64)rate, NULL);
}
