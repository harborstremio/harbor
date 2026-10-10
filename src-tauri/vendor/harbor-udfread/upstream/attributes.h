/*
 * This file is part of libudfread
 * Copyright (C) 2010  hpi1
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

#ifndef LIBUDFREAD_ATTRIBUTES_H_
#define LIBUDFREAD_ATTRIBUTES_H_

#ifdef UDFREAD_API_EXPORT
#  if defined(_WIN32)
#    define UDF_PUBLIC  __declspec(dllexport)
#  elif defined(__GNUC__) && __GNUC__ >= 4
#    define UDF_PUBLIC  __attribute__((visibility("default")))
#  endif
#endif

#endif /* LIBUDFREAD_ATTRIBUTES_H_ */
