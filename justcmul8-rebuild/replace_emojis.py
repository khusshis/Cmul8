import re
with open('src/lib/simulation/simTypeRegistry.ts', 'r', encoding='utf-8') as f:
    content = f.read()

lucide_imports = '''import type { LucideIcon } from "lucide-react";
import { Users, DoorOpen, AlignJustify, Monitor, Zap, Shuffle, LogOut, Package, GitFork, Link as LinkIcon, AlertTriangle, Bell, Car, ArrowRight, MoreVertical, Fuel, Wrench, User, Flag, Droplets, ArrowDownCircle, Database, FlaskConical, Archive, Factory, Inbox, Settings, Search, CheckCircle, Truck, Radio, Upload, Server, Signal, Megaphone, Download } from "lucide-react";
'''

content = content.replace('import type { SimTypeId, NodeType, DistributionType } from "./types";', 
                          'import type { SimTypeId, NodeType, DistributionType } from "./types";\n' + lucide_imports)

content = content.replace('icon: string;', 'icon: LucideIcon;')

replacements = {
    '"🧍"': 'Users',
    '"🚪"': 'DoorOpen',
    '"🚧"': 'AlignJustify',
    '"🖥️"': 'Monitor',
    '"⚡"': 'Zap',
    '"🔀"': 'Shuffle',
    '"📦"': 'Package',
    '"🔱"': 'GitFork',
    '"⛓️"': 'LinkIcon',
    '"⚠️"': 'AlertTriangle',
    '"🔔"': 'Bell',
    '"🚗"': 'Car',
    '"➡️"': 'ArrowRight',
    '"🚦"': 'MoreVertical',
    '"⛽"': 'Fuel',
    '"🔧"': 'Wrench',
    '"🚶"': 'User',
    '"🏁"': 'Flag',
    '"💧"': 'Droplets',
    '"🔵"': 'ArrowDownCircle',
    '"🛢️"': 'Database',
    '"⚗️"': 'FlaskConical',
    '"🏺"': 'Archive',
    '"⭕"': 'ArrowDownCircle',
    '"🏭"': 'Factory',
    '"📥"': 'Inbox',
    '"⚙️"': 'Settings',
    '"🔩"': 'Wrench',
    '"🔍"': 'Search',
    '"✅"': 'CheckCircle',
    '"🚛"': 'Truck',
    '"🗄️"': 'Archive',
    '"🏗️"': 'Factory',
    '"📡"': 'Radio',
    '"📤"': 'Upload',
    '"📶"': 'Signal',
    '"📢"': 'Megaphone',
    '"📥"': 'Download',
}

for emoji, component in replacements.items():
    content = content.replace(f'icon: {emoji}', f'icon: {component}')

with open('src/lib/simulation/simTypeRegistry.ts', 'w', encoding='utf-8') as f:
    f.write(content)
