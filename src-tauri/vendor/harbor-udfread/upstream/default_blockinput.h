/*
 * This file is part of libudfread
 * Copyright (C) 2014 VLC authors and VideoLAN
 *
 * Authors: Petri Hintukainen <phintuka@users.sourceforge.net>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library. If not, see
 * <http://www.gnu.org/licenses/>.
 */

#ifndef UDFREAD_DEFAULT_BLOCKINPUT_H_
#define UDFREAD_DEFAULT_BLOCKINPUT_H_

#include "blockinput.h"


udfread_block_input *block_input_new(const char *path);

#endif /* UDFREAD_DEFAULT_BLOCKINPUT_H_ */
