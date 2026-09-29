"""Deterministic, full 3D scene renders. Requires Blender bpy 4.3 / numpy<2.

No image planes, cutouts, optical-flow morphing, random motion, or remote API.
Run: python scripts/render-recordings.py hotel --out /tmp/ghostdesk-renders
Use --preview for three review frames, then omit it for the 24fps source frames.
"""
import argparse
import math
import os
import json
from pathlib import Path

import bpy
from mathutils import Vector, Quaternion

FPS = 24
parser = argparse.ArgumentParser()
parser.add_argument('scene', choices=['hotel', 'stage', 'auction', 'receiver'])
parser.add_argument('--out', default='/tmp/ghostdesk-renders')
parser.add_argument('--preview', action='store_true')
parser.add_argument('--samples', type=int, default=8)
parser.add_argument('--geometry-report', type=Path, help='Validate all hotel wheel contacts without rendering')
parser.add_argument('--start-frame', type=int, default=0, help='Resume an interrupted render at a known completed boundary')
args = parser.parse_args()
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = args.samples
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 4
scene.cycles.diffuse_bounces = 3
scene.cycles.glossy_bounces = 2
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = .08
scene.render.resolution_x = 960
scene.render.resolution_y = 540
scene.render.resolution_percentage = 100
scene.render.fps = FPS
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.use_persistent_data = True
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8
scene.world = bpy.data.worlds.new('Night ambient')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.17,.21,.28,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .22
scene.view_settings.view_transform = 'AgX'


def material(name, rgb, rough=.5, metal=0, noise=0):
    m = bpy.data.materials.new(name); m.diffuse_color = (*rgb,1); m.use_nodes = True
    n=m.node_tree.nodes; links=m.node_tree.links; p=n.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metal
    if noise:
        tex=n.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value=noise
        tex.inputs['Detail'].default_value=3
        ramp=n.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color=(*(v*.72 for v in rgb),1)
        ramp.color_ramp.elements[1].color=(*(min(1,v*1.14) for v in rgb),1)
        links.new(tex.outputs['Fac'],ramp.inputs[0]); links.new(ramp.outputs[0],p.inputs['Base Color'])
        bump=n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.13; bump.inputs['Distance'].default_value=.025
        links.new(tex.outputs['Fac'],bump.inputs['Height']); links.new(bump.outputs[0],p.inputs['Normal'])
    return m


def emissive(name, rgb, strength=1):
    m=material(name,rgb,.35)
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Emission Color'].default_value=(*rgb,1)
    p.inputs['Emission Strength'].default_value=strength
    return m,p


def box(name, loc, size, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=bpy.context.object; o.name=name; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if mat:o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Soft manufactured edges','BEVEL'); mod.width=bevel; mod.segments=3
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o


def cylinder(name, loc, radius, depth, mat, rotation=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=radius,depth=depth,location=loc,rotation=rotation)
    o=bpy.context.object;o.name=name;o.data.materials.append(mat)
    mod=o.modifiers.new('Edge chamfer','BEVEL');mod.width=.008;mod.segments=2
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o


def rod(name, a, b, radius, mat):
    a,b=Vector(a),Vector(b);o=cylinder(name,(a+b)/2,radius,(b-a).length,mat)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o


def area(name, loc, target, power, color=(1,.9,.72), size=2):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o


def camera(loc, target, lens=32):
    d=bpy.data.cameras.new('Fixed level camera');o=bpy.data.objects.new('Fixed level camera',d)
    scene.collection.objects.link(o);o.location=loc
    # World up defines roll: the camera never banks while the object moves.
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    d.lens=lens;scene.camera=o


def text(name, body, loc, size, mat):
    c=bpy.data.curves.new(name,'FONT');c.body=body;c.size=size;c.align_x='CENTER';c.extrude=.0005
    o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.location=loc
    o.rotation_euler=(math.pi/2,0,0);o.data.materials.append(mat);return o


metal=material('Brushed steel',(.43,.48,.49),.28,.78,180)
rubber=material('Rubber',(.017,.022,.025),.84)
dark=material('Charcoal',(.033,.043,.052),.65)
wood=material('Oiled walnut',(.12,.055,.028),.45,noise=7)
white=material('Warm white',(.72,.72,.66),.72)
lampmat,_=emissive('Light diffuser',(.92,.83,.64),3)
updates=[]


def build_hotel():
    from hotel_motion import (ROOM_ROWS, CURTAIN_Y, DOOR_404_ANGLE,
                              CART_X, distance_at, cart_y, foot_pose)
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.055,.10,.17,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.045
    scene.view_settings.exposure=-.3
    floor=material('Grey fine stone',(.27,.29,.28),.32,noise=135)
    wall=material('Painted plaster',(.25,.29,.27),.8,noise=100)
    trim=material('Lower wall olive',(.10,.14,.12),.55,noise=90)
    door=material('Hotel door',(.11,.075,.041),.48,noise=25)
    yellow=material('Yellow protective film',(.52,.40,.11),.6,noise=7)
    box('Walkable floor',(0,4,-.06),(3.2,20,.12),floor)
    for x in [-1.55,1.55]:box('Black floor border',(x,4,.005),(.10,20,.014),dark)
    for y in range(-6,15):box('Tile joint',(0,y,.002),(3.0,.009,.002),trim)
    for x in [-.8,0,.8]:box('Tile joint',(x,4,.002),(.006,20,.002),trim)
    # The right wall has a real opening at 404, with a dark room behind it.
    for x in [-1.66,1.66]:
        segments=[(-6,14)] if x<0 else [(-6,3.93),(5.07,14)]
        for start,end in segments:
            mid=(start+end)/2;length=end-start
            box('Side wall',(x,mid,1.5),(.15,length,3),wall)
            box('Wainscot',(x*.965,mid,.55),(.035,length,1.1),trim)
            box('Rail',(x*.95,mid,1.12),(.03,length,.035),metal)
        if x>0:box('404 wall above opening',(x,4.5,2.63),(.15,1.14,.74),wall)
    box('404 room rear wall',(3.0,4.5,1.4),(.15,1.4,2.8),dark)
    for y in [3.84,5.16]:box('404 room side wall',(2.28,y,1.4),(1.6,.12,2.8),dark)
    box('404 room floor',(2.2,4.5,-.025),(1.3,1.25,.05),dark)
    box('404 threshold',(1.63,4.5,.018),(.25,1.02,.036),wood)
    box('Ceiling',(0,4,3.04),(3.4,20,.12),wall)
    box('End wall',(0,14,1.5),(3.3,.12,3),trim)
    glass,_=emissive('Blue window',(.10,.20,.31),.22)
    box('Window',(0,13.90,1.8),(1.1,.04,1.25),glass)
    for x in [-.55,0,.55]:box('Window frame',(x,13.84,1.8),(.035,.03,1.3),dark)
    box('Window mullion',(0,13.84,1.8),(1.13,.03,.035),dark)
    night_lamp,_=emissive('Old fluorescent diffuser',(.43,.66,.61),.9)
    dead_lamp=material('Unlit fluorescent diffuser',(.09,.11,.10),.9)
    sign_back=material('Door-mounted number plaque',(.027,.031,.028),.6,.3)
    sign_ink=material('Room numerals',(.78,.72,.53),.42,.2)
    for row,y in enumerate(ROOM_ROWS):
        for side,x in enumerate([-1.565,1.565]):
            room=401+row*2+side
            # Each plaque is physically attached to the door leaf. No hanging signs.
            for edge in [-.55,.55]:box(f'Room {room} frame jamb',(x,y+edge,1.10),(.10,.075,2.20),dark,.012)
            box(f'Room {room} lintel',(x,y,2.18),(.10,1.17,.08),dark,.01)
            before=set(bpy.data.objects)
            box(f'Room {room} door',(x*.985,y,1.06),(.045,1.015,2.10),door,.012)
            inner=-1 if side else 1
            handle_x=x+inner*.07
            rod(f'Room {room} handle',(handle_x,y-.31,.96),(handle_x,y-.13,.96),.017,metal)
            plaque_x=x+inner*.045
            box(f'Room {room} plaque',(plaque_x,y,1.77),(.022,.42,.20),sign_back,.01)
            label=text(f'Room {room} number',str(room),(plaque_x+inner*.013,y,1.77),.15,sign_ink)
            label.rotation_euler=(math.pi/2,0,math.pi/2 if side==0 else -math.pi/2)
            label.data.align_y='CENTER'
            if room==404:
                leaf=[o for o in bpy.data.objects if o not in before]
                pivot=bpy.data.objects.new('404 door hinge',None);scene.collection.objects.link(pivot)
                pivot.location=(x*.985,y-.5075,0)
                bpy.context.view_layer.update()
                for o in leaf:o.parent=pivot;o.matrix_parent_inverse=pivot.matrix_world.inverted()
                pivot.rotation_euler.z=DOOR_404_ANGLE
        power=[25,25,0,14][row]
        box('Ceiling light',(0,y,2.95),(.30,.75,.06),night_lamp if power else dead_lamp,.02)
        if power:area('Ceiling illumination',(0,y,2.88),(0,y,0),power,(.51,.76,.71),size=.55)
    # A wall repair bay between 404 and 406. It does not cover a numbered room.
    verts=[];faces=[];ny=28;nz=15
    for j in range(ny+1):
        y=CURTAIN_Y[0]+j*(CURTAIN_Y[1]-CURTAIN_Y[0])/ny
        for k in range(nz+1):
            z=.10+k*2.65/nz
            x=1.48+.025*math.sin(j*.85+k*.21)+.012*math.sin(k*1.6+j*.32)
            verts.append((x,y,z))
    for j in range(ny):
        for k in range(nz):
            a=j*(nz+1)+k;faces.append((a,a+1,a+nz+2,a+nz+1))
    mesh=bpy.data.meshes.new('Protective curtain mesh');mesh.from_pydata(verts,[],faces);mesh.materials.append(yellow)
    o=bpy.data.objects.new('Wall repair covering between 404 and 406',mesh);scene.collection.objects.link(o)
    for polygon in mesh.polygons:polygon.use_smooth=True
    for y in CURTAIN_Y:rod('Wall repair support',(1.43,y,.06),(1.43,y,2.83),.018,metal)
    before=set(bpy.data.objects)
    box('Cart lower platform',(0,0,.27),(.82,1.15,.08),metal,.025)
    box('Cart dark undertray',(0,0,.225),(.66,.94,.08),dark,.02)
    for x in [-.39,.39]:
        for y in [-.53,.53]:rod('Vertical upright',(x,y,.3),(x,y,1.30),.020,metal)
    for z in [.34,.62,.92,1.23]:
        for y in [-.53,.53]:rod('Basket rail',(-.39,y,z),(.39,y,z),.013,metal)
        for x in [-.39,.39]:rod('Basket rail',(x,-.53,z),(x,.53,z),.013,metal)
    for x in [-.26,-.13,0,.13,.26]:
        for y in [-.535,.535]:rod('Basket vertical wire',(x,y,.34),(x,y,1.23),.009,metal)
    fabric=material('Folded linen weave',(.75,.74,.68),.94,noise=260)
    for z in range(6):box('Folded linen',(0,.02,.38+z*.115),(.68,.94,.102),fabric,.025)
    for x in [-.17,.18]:box('Top folded towels',(x,.02,1.11),(.34,.89,.075),fabric,.025)
    # Rear push bar joins the basket; both hands stay in contact with this bar.
    rod('Cart push bar',(-.35,.67,1.13),(.35,.67,1.13),.021,metal)
    for x in [-.35,.35]:rod('Push bar support',(x,.53,.94),(x,.67,1.13),.018,metal)
    wheels=[]
    for x in [-.32,.32]:
        for y in [-.44,.44]:
            rod('Caster bracket',(x,y,.16),(x,y,.27),.022,metal)
            wh=cylinder('Rubber wheel',(x,y,.105),.105,.06,rubber,(0,math.pi/2,0));wheels.append(wh)
            cylinder('Wheel hub',(x,y,.105),.046,.068,metal,(0,math.pi/2,0))
    cart=[o for o in bpy.data.objects if o not in before and o.parent is None]
    root=bpy.data.objects.new('Cart rigid chassis',None);scene.collection.objects.link(root)
    for o in cart:o.parent=root

    def ellipsoid(name, loc, scale, mat):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=loc)
        o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat)
        for face in o.data.polygons:face.use_smooth=True
        return o
    uniform=material('Off-white work jacket',(.69,.68,.58),.95,noise=150)
    trousers=material('Dark work trousers',(.075,.086,.078),.92,noise=130)
    skin=material('Worker skin',(.30,.22,.15),.93)
    before=set(bpy.data.objects)
    ellipsoid('Worker jacket',(0,1.04,1.27),(.23,.16,.34),uniform)
    ellipsoid('Worker pelvis',(0,1.08,.92),(.19,.14,.15),trousers)
    cylinder('Worker neck',(0,1.02,1.60),.065,.13,skin)
    ellipsoid('Worker head',(0,.99,1.74),(.115,.105,.15),skin)
    ellipsoid('Worker nose',(0,.884,1.74),(.025,.028,.034),skin)
    ellipsoid('Worker white cap',(0,1.0,1.86),(.124,.117,.054),uniform)
    box('Worker cap brim',(0,.875,1.84),(.25,.17,.018),uniform,.01)
    for side in [-1,1]:
        ellipsoid('Worker eye shadow',(side*.044,.893,1.775),(.021,.007,.009),dark)
        rod('Jacket collar',(0,.876,1.58),(side*.07,.882,1.52),.009,white)
    rod('Jacket seam',(0,.872,1.02),(0,.872,1.50),.004,trim)
    for z in [1.15,1.27,1.39]:ellipsoid('Jacket button',(0,.864,z),(.008,.004,.008),dark)
    for side in [-1,1]:
        shoulder=(side*.19,1.03,1.47);elbow=(side*.29,.89,1.25);hand=(side*.30,.67,1.13)
        rod('Worker sleeve upper',shoulder,elbow,.078,uniform)
        ellipsoid('Worker elbow',elbow,(.077,.077,.077),uniform)
        rod('Worker sleeve forearm',elbow,hand,.065,uniform)
        ellipsoid('Worker hand',hand,(.048,.065,.037),skin)
    legs=[]
    for side in [-1,1]:
        upper=rod('Worker trouser thigh',(side*.105,1.08,.94),(side*.11,1.08,.50),.08,trousers)
        lower=rod('Worker trouser shin',(side*.11,1.08,.50),(side*.11,1.08,.12),.064,trousers)
        foot=ellipsoid('Worker grounded boot',(side*.11,1.0,.075),(.08,.15,.075),rubber)
        legs.append((side,upper,lower,foot))
    person=[o for o in bpy.data.objects if o not in before]
    actor=bpy.data.objects.new('Worker walking behind cart',None);scene.collection.objects.link(actor)
    for o in person:o.parent=actor
    def segment(o,a,b):
        a,b=Vector(a),Vector(b);o.location=(a+b)/2
        o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
        o.scale.z=(b-a).length/(max(v.co.z for v in o.data.vertices)-min(v.co.z for v in o.data.vertices))
    def update(t):
        distance=distance_at(t)
        root.location=(CART_X,cart_y(t),0)
        root.rotation_euler=(0,0,0);root.scale=(1,1,1)
        actor.location=root.location
        for wh in wheels:
            wh.rotation_mode='QUATERNION'
            wh.rotation_quaternion=Quaternion((1,0,0),distance/.105) @ Quaternion((0,1,0),math.pi/2)
        for side,upper,lower,foot in legs:
            offset,height=foot_pose(t,side)
            hip=(side*.105,1.08,.94);ankle=(side*.11,1.08+offset,height+.055)
            knee=(side*.11,1.04+offset*.5,.51+max(0,height-.075)*.35)
            segment(upper,hip,knee);segment(lower,knee,ankle)
            foot.location=(side*.11,1.0+offset,height)
    updates.append(update)
    area('Camera-side fill',(-.7,-1.5,2.4),(0,4,.8),22,(.36,.52,.72),2.2)
    area('404 threshold fill',(2.1,4.4,1.9),(1.1,4.5,.6),1.0,(.3,.42,.43),.4)
    camera((.2,-2.7,2.55),(0,6.5,1.0),29)
    return 12


def build_stage():
    box('Stage',(0,3,-.15),(10,7,.3),wood)
    box('Rear wall',(0,6.6,2.2),(11,.25,4.5),dark)
    velvet=material('Curtain velvet',(.095,.014,.023),.98,noise=90)
    for side in [-1,1]:
        for i in range(16):cylinder('Curtain fold',(side*(3.6+i*.09),5.4,2.1),.10,4.2,velvet)
    rod('Microphone stand',(0,3,.03),(0,3,1.43),.014,metal)
    cylinder('Stand base',(0,3,.025),.23,.05,dark)
    mic=rod('Microphone',(0,2.89,1.43),(0,3.10,1.53),.026,dark)
    for x in [-2,2]:box('Stage monitor',(x,2.1,.17),(.65,.48,.34),dark,.06)
    for row in range(3):
        for col in range(9):
            x=(col-4)*.72;y=-1.8+row*.74
            box('Seat',(x,y,.33),(.55,.5,.13),velvet,.08)
            box('Seat back',(x,y-.24,.64),(.56,.11,.59),velvet,.09)
    lights=[area('Cue light '+str(i),(x,1,3.8),(0,3.3,.2),500,size=.65) for i,x in enumerate([-2,0,2])]
    colors=[(1,.40,.07),(.055,.22,1),(1,.94,.83),(1,.025,.012)]
    cue_starts=[.7,3.7,6.7,9.7]
    def update(t):
        for light in lights:light.data.energy=0
        for start,color in zip(cue_starts,colors):
            age=t-start
            if 0<=age<2.6:
                envelope=min(1,age/.4,(2.6-age)/.5)
                for light in lights:light.data.energy=800*max(0,envelope);light.data.color=color
    updates.append(update)
    area('Dim house lights',(0,-3,3.5),(0,2,0),35,(.4,.48,.6),4)
    camera((.8,-6.7,2.4),(0,3,1),34)
    return 14


def build_auction():
    box('Room floor',(0,2,-.08),(7,8,.16),wood)
    box('Back wall',(0,4.3,1.7),(7,.12,3.4),material('Gallery plaster',(.19,.17,.14),.85,noise=90))
    box('Desk top',(0,1,.72),(3.4,1.6,.12),wood,.04)
    for x in [-1.4,1.4]:box('Desk leg',(x,1,.33),(.13,1.2,.66),dark)
    box('Monitor bezel',(0,1.45,1.65),(2.3,.14,1.25),dark,.07)
    screenmat,_=emissive('Screen surface',(.015,.028,.036),.4)
    box('Monitor screen',(0,1.37,1.65),(2.13,.012,1.08),screenmat,.015)
    box('Monitor neck',(0,1.5,1.0),(.10,.12,.32),metal)
    box('Monitor foot',(0,1.25,.805),(.65,.44,.04),dark,.03)
    ink,_=emissive('Screen text',(.65,.86,.87),.9)
    muted,_=emissive('Screen secondary',(.25,.43,.48),.5)
    text('Lot number','LOT-27',(0,1.352,2.0),.14,muted)
    text('Bid name','MOTH',(0,1.351,1.75),.22,ink)
    text('Bid value','310',(.36,1.351,1.46),.17,ink)
    status=text('Auction status','OPEN',(0,1.350,1.22),.11,ink)
    text('Connection label','MOTH',(-.63,1.350,1.47),.078,muted)
    connected,lednode=emissive('Connection LED',(.05,.8,.37),3)
    led=cylinder('Connection LED',(-.85,1.345,1.51),.028,.015,connected,(math.pi/2,0,0))
    box('Closed ledger',(-1.1,.85,.82),(.54,.56,.06),dark,.016)
    for i in range(4):box('Paper edges',(-1.1,.85,.846+i*.003),(.52,.54,.002),white)
    cylinder('Gavel head',(1.02,.81,.86),.07,.28,wood,(0,math.pi/2,.2))
    rod('Gavel handle',(1.02,.81,.86),(1.05,.41,.82),.024,wood)
    area('Warm gallery lamp',(-2,-.5,3),(0,1,.8),150,(1,.68,.35),2.0)
    area('Screen glow',(0,1.2,1.7),(0,-.5,.6),15,(.35,.67,.85),1.5)
    def update(t):
        on=t<2
        lednode.inputs['Emission Strength'].default_value=3 if on else 0
        lednode.inputs['Base Color'].default_value=(.05,.8,.37,1) if on else (.018,.035,.027,1)
        status.data.body='CLOSED' if t>=9 else 'OPEN'
    updates.append(update)
    camera((.45,-2.8,2.15),(0,1.4,1.48),44)
    return 11


def build_receiver():
    box('Desk',(0,1,.68),(3,2,.13),wood,.035)
    box('Rear wall',(0,2.5,1.8),(5,.1,3.5),material('Weathered coastal plaster',(.16,.21,.22),.8,noise=110))
    box('Receiver case',(0,1,1.02),(1.7,.65,.58),material('Painted olive instrument',(.10,.15,.13),.47,noise=95),.045)
    box('Receiver face',(0,.665,1.02),(1.58,.025,.47),dark,.014)
    window,_=emissive('Frequency display',(.25,.47,.32),.6)
    box('Frequency scale',(-.20,.640,1.10),(.68,.012,.15),window,.01)
    for i in range(13):box('Scale mark',(-.48+i*.044,.63,1.10),(.005,.009,.065 if i%3 else .10),dark)
    for x in [-.60,.55]:cylinder('Receiver dial',(x,.60,.96),.065,.07,metal,(math.pi/2,0,0))
    for i in range(9):box('Speaker slot',(.28+i*.04,.639,1.17),(.012,.012,.13),rubber,.005)
    signal,node=emissive('Received signal lamp',(1,.47,.06),0)
    cylinder('Signal bezel',(.32,.616,.95),.055,.03,metal,(math.pi/2,0,0))
    cylinder('Signal lens',(.32,.593,.95),.041,.026,signal,(math.pi/2,0,0))
    text('Receiver label','RX',(.32,.61,.80),.06,white)
    text('Receiver header','COASTAL RECEIVER',(-.16,.61,1.225),.042,white)
    rod('Antenna',(.6,1.2,1.30),(.92,1.3,2.0),.009,metal)
    box('Independent battery',(-1.07,1.22,.88),(.33,.4,.28),dark,.03)
    for i in range(22):
        a=(-.78+i*.032,.94+.055*math.sin(i*.9),.77+.02*math.cos(i*.9))
        b=(-.78+(i+1)*.032,.94+.055*math.sin((i+1)*.9),.77+.02*math.cos((i+1)*.9))
        rod('Power lead',a,b,.008,rubber)
    box('Paper notebook',(.90,.52,.76),(.46,.55,.045),white,.008)
    for i in range(7):box('Notebook ruled line',(.90,.31+i*.06,.785),(.38,.003,.001),dark)
    area('Desk practical',(-1,-.1,2.3),(0,1,.7),95,(1,.75,.45),1.1)
    area('Window fill',(1,2,2.7),(0,1,.8),55,(.40,.60,.83),1.8)
    pulses=[];cursor=1.0;unit=.28
    for group in ['...','---','...']:
        for i,s in enumerate(group):
            end=cursor+unit*(1 if s=='.' else 3);pulses.append((cursor,end));cursor=end+unit
        cursor+=2*unit
    def update(t):
        power=0
        for start,end in pulses:
            if start<=t<end:power=min(1,(t-start)/.035,(end-t)/.035)
        node.inputs['Emission Strength'].default_value=power*4
        node.inputs['Base Color'].default_value=(.9,.25,.018,1) if power else (.07,.025,.009,1)
    updates.append(update)
    camera((.55,-1.85,1.92),(0,.97,1.05),43)
    return 11


duration=globals()['build_'+args.scene]()
if args.geometry_report:
    if args.scene != 'hotel':raise SystemExit('Geometry validation applies to the moving cart')
    from bpy_extras.object_utils import world_to_camera_view
    from hotel_motion import SPEED, CURTAIN_Y, ROOM_ROWS, DOOR_404_ANGLE
    root=bpy.data.objects['Cart rigid chassis']
    actor=bpy.data.objects['Worker walking behind cart']
    wheels=[o for o in bpy.data.objects if o.name.startswith('Rubber wheel')]
    bounds=[];positions=[];visible_contacts=[]
    for frame in range(duration*FPS):
        for update in updates:update(frame/FPS)
        bpy.context.view_layer.update()
        assert tuple(root.scale)==(1,1,1) and tuple(root.rotation_euler)==(0,0,0)
        assert (actor.location-root.location).length<1e-6
        positions.append(root.location.y)
        visible=0
        for wheel in wheels:
            contact=wheel.matrix_world.translation-Vector((0,0,.105))
            assert abs(contact.z)<1e-6 and -1.5<contact.x<1.4 and -6<contact.y<14
            pixel=world_to_camera_view(scene,scene.camera,contact)
            visible+=int(0<pixel.x<1 and 0<pixel.y<1 and pixel.z>0)
            bounds.append([contact.x,contact.y,contact.z])
        visible_contacts.append(visible)
    assert all(a>b for a,b in zip(positions,positions[1:])), 'Cart must never reverse within the recording'
    assert visible_contacts[0]==4 and visible_contacts[-1]==0
    # The person follows the cart past the camera before the archived clip restarts.
    assert actor.location.y+1.25<scene.camera.location.y
    assert abs(bpy.data.objects['404 door hinge'].rotation_euler.z-DOOR_404_ANGLE)<1e-6
    for row,y in enumerate(ROOM_ROWS):
        assert not (y-.59<CURTAIN_Y[1] and y+.59>CURTAIN_Y[0]), 'Cover must not overlap any doorway'
        for room in [401+row*2,402+row*2]:
            leaf=bpy.data.objects[f'Room {room} door']
            plaque=bpy.data.objects[f'Room {room} plaque']
            number=bpy.data.objects[f'Room {room} number']
            for item in [plaque,number]:
                local=leaf.matrix_world.inverted() @ item.matrix_world.translation
                assert abs(local.x)<.07 and abs(local.y)<1e-5, (room,tuple(local))
    report={'frames':duration*FPS,'wheelContacts':len(bounds),'fps':FPS,
            'allContactsOnFloor':True,'forwardMotionOnly':True,'cartAndPersonExitBeforeRepeat':True,
            'door404OpenDegrees':math.degrees(DOOR_404_ANGLE),'numberPlaquesAttachedToDoors':8,
            'curtainYBounds':list(CURTAIN_Y),'curtainOverlapsDoorway':False,
            'cartRollRadians':0,'cartScale':[1,1,1],'speedMetersPerSecond':SPEED,
            'wheelRadiusMeters':.105,'floorXBounds':[-1.5,1.4],
            'pathXBounds':[min(b[0] for b in bounds),max(b[0] for b in bounds)],
            'pathYBounds':[min(b[1] for b in bounds),max(b[1] for b in bounds)]}
    args.geometry_report.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report));raise SystemExit(0)
out=Path(args.out)/args.scene;out.mkdir(parents=True,exist_ok=True)
indices=[0,int(duration*FPS/3),int(duration*FPS*2/3)] if args.preview else range(args.start_frame,duration*FPS)
cache={}
for frame in indices:
    t=frame/FPS
    for update in updates:update(t)
    scene.frame_set(frame+1)
    scene.render.filepath=str(out/f'{frame:04d}.png')
    # Static-camera records can legitimately contain unchanged frames. Reuse an
    # identical full 3D scene, never interpolate photographs or a moving cutout.
    key=None
    if args.scene=='auction':key=('auction',t>=2,t>=9)
    if args.scene=='receiver':key=('receiver',round(bpy.data.materials['Received signal lamp'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value,5))
    if args.scene=='stage':key=tuple((round(o.data.energy,4),tuple(round(x,4) for x in o.data.color)) for o in bpy.data.objects if o.type=='LIGHT' and o.name.startswith('Cue light'))
    if key in cache:
        dest=Path(scene.render.filepath)
        if dest.exists():dest.unlink()
        os.link(cache[key],dest)
        continue
    bpy.ops.render.render(write_still=True)
    if key is not None:cache[key]=scene.render.filepath
    print(f'PROGRESS {args.scene} {frame+1}/{duration*FPS}',flush=True)
print(f'COMPLETE {args.scene} {duration}s {FPS}fps',flush=True)
