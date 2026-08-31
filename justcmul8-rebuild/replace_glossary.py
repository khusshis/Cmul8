import re

file_path = 'src/lib/simulation/simTypeRegistry.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

node_mapping = {
    'source': ('Arrival Point', 'Where new customers, items, or requests enter the system'),
    'queue': ('Waiting Line', 'A line where things wait their turn'),
    'resource': ('Staff / Machine', 'A worker or machine that serves one thing at a time'),
    'service': ('Processing Step', 'A step that takes a fixed or random amount of time'),
    'decision': ('Split Path', 'Sends each item down one of several paths, by chance'),
    'sink': ('Exit Point', 'Where things leave the system — results are counted here'),
    'container': ('Tank / Reservoir', 'Holds a continuous amount of something (like liquid or stock)'),
    'store': ('Storage Buffer', "Holds a limited number of items until they're needed"),
    'event_trigger': ('Condition Watcher', 'Waits for a condition to become true, then fires an event'),
    'priority_resource': ('Priority Staff / Machine', 'Like Staff/Machine, but urgent items go first'),
    'channel': ('Transmission Link', 'Carries a signal or message with a travel delay'),
    'broadcaster': ('Broadcast Hub', 'Copies one message out to every connected path at once'),
    'any_of': ('Wait For Any', 'Continues as soon as ONE of several things happens'),
    'all_of': ('Wait For All', 'Continues only once ALL of several things have happened'),
    'interrupter': ('Interrupt Signal', 'Stops another step partway through, on purpose')
}

domain_mapping = {
    'human_queue': 'People & Service Lines',
    'vehicle': 'Traffic & Vehicles',
    'liquid': 'Liquid & Material Flow',
    'manufacturing': 'Manufacturing Line',
    'logistics': 'Warehouse & Logistics',
    'network_signal': 'Network & Signals'
}

# 1. Update Domain labels
for domain_id, new_label in domain_mapping.items():
    # Looking for:
    #   id: "human_queue",
    #   label: "HUMAN QUEUE",
    # We replace the label value.
    pattern = rf'(id:\s*"{domain_id}",\s*\n\s*label:\s*")[^"]+(")'
    content = re.sub(pattern, rf'\g<1>{new_label}\g<2>', content)

# 2. Update PaletteNodes labels and descs
for node_type, (new_label, new_desc) in node_mapping.items():
    # We look for lines that contain: type: "source" ... label: "Old" ... desc: "Old"
    # This is a bit tricky, but since they are on a single line usually:
    # { type: "source", label: "Entry", icon: DoorOpen, color: "var(--neon-green)", desc: "Customer arrival point", spriteKey: "source" }
    
    # We can match type: "node_type", ... label: "...", ... desc: "..."
    # We will use a regex that matches `type: "node_type",` then replaces `label: "..."` and `desc: "..."` within that same line.
    
    def replacer(match):
        line = match.group(0)
        # Replace label
        line = re.sub(r'label:\s*"[^"]+"', f'label: "{new_label}"', line)
        # Replace desc
        line = re.sub(r'desc:\s*"[^"]+"', f'desc: "{new_desc}"', line)
        return line
        
    pattern = rf'{{[^}}]*type:\s*"{node_type}"[^}}]*}}'
    content = re.sub(pattern, replacer, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("simTypeRegistry.ts updated successfully!")

# Update NodeCanvas.tsx NODE_LABELS
canvas_path = 'src/components/workspace/NodeCanvas.tsx'
with open(canvas_path, 'r', encoding='utf-8') as f:
    canvas_content = f.read()

for node_type, (new_label, _) in node_mapping.items():
    # source: "Arrival Point",
    pattern = rf'(\s*{node_type}:\s*")[^"]+(",)'
    canvas_content = re.sub(pattern, rf'\g<1>{new_label}\g<2>', canvas_content)

with open(canvas_path, 'w', encoding='utf-8') as f:
    f.write(canvas_content)

print("NodeCanvas.tsx updated successfully!")
