import { useAudit } from "../../contexts/AuditContext";
import { useCallback } from "react";

import Card from "../common/Card";
import CardTitle from "../common/CardTitle";
import Pill from "../common/Pill";

import ProductMatrix from "./ProductMatrix";
import SimpleMatrix from "./SimpleMatrix";

import {
    DTT_FLAVOURS,
    DTT_SIZES,
    RTD_FLAVOURS,
    RTD_SIZES,
    CHAMP_FLAVOURS,
    CHAMP_SIZES,
    GOFRUT_FLAVOURS,
    GOFRUT_SIZES,
    WB_FLAVOURS,
    WB_SIZES,
    FF_FLAVOURS,
    JP_FLAVOURS,
    JP_SIZES,
    WATER_SIZES,
    COCOA_SACHETS,
    COCOA_JARS,
    DC_SACHETS,
    DC_JARS,
    GLUC_SACHETS,
    GLUC_PKTS,
    GLUC_JARS,
    RELOAD_SIZES,
    ENERGY_SIZES,
} from "../../config/productCatalog";

export default function ProductsStep() {
    const { audit, setAudit } = useAudit();

    const products = audit.products || {};

    const productError = "";

    const updateMatrix = useCallback(
    (key) => (fn) => {

        setAudit(prev => ({

            ...prev,

            products: {

                ...prev.products,

                [key]: fn(prev.products?.[key] || {})

            }

        }));

    },

    [setAudit]

);

    const toggleList = useCallback(

    (group, item) =>

        setAudit(prev => ({

            ...prev,

            products: {

                ...prev.products,

                [group]: {

                    ...(prev.products?.[group] || {}),

                    [item]: !(prev.products?.[group] || {})[item],

                }

            }

        })),

    [setAudit]

);

    return (
        <>
            {productError && (
                <div
                    style={{
                        background: "#FEE2E2",
                        color: "#B91C1C",
                        padding: 16,
                        borderRadius: 12,
                        marginBottom: 14,
                        fontWeight: 600,
                    }}
                >
                    {productError}
                </div>
            )}
                        <Card>
                <ProductMatrix
                    product="DTT"
                    title="Quencher DTD — Dilute to Drink"
                    sizes={DTT_SIZES}
                    flavours={DTT_FLAVOURS}
                    checked={products.dtt || {}}
                    onChange={updateMatrix("dtt")}
                />
            </Card>

            <Card>
                <ProductMatrix
                    product="RTD"
                    title="Quencher RTD — Ready to Drink"
                    sizes={RTD_SIZES}
                    flavours={RTD_FLAVOURS}
                    checked={products.rtd || {}}
                    onChange={updateMatrix("rtd")}
                />
            </Card>

            <Card>
                <CardTitle icon="🥤">Champ</CardTitle>

                <SimpleMatrix
                    label="Sizes × Flavours"
                    sizes={CHAMP_SIZES}
                    flavours={CHAMP_FLAVOURS}
                    checked={products.champ || {}}
                    onChange={updateMatrix("champ")}
                />
            </Card>
                        <Card>
                <CardTitle icon="💧">
                    Quencher Life Water
                </CardTitle>

                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                    }}
                >
                    {WATER_SIZES.map((size) => (
                        <Pill
                            key={size}
                            label={size}
                            active={!!(products.water || {})[size]}
                            onClick={() =>
                                toggleList("water", size)
                            }
                        />
                    ))}
                </div>
            </Card>

            <Card>
                <CardTitle icon="🍫">
                    Raha Drinking Chocolate
                </CardTitle>

                <div
                    style={{
                        marginBottom: 10,
                        fontSize: 12,
                        fontWeight: 700,
                    }}
                >
                    Sachets
                </div>

                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        marginBottom: 12,
                    }}
                >
                    {DC_SACHETS.map((size) => (
                        <Pill
                            key={size}
                            label={size}
                            active={!!(products.dc || {})[size]}
                            onClick={() =>
                                toggleList("dc", size)
                            }
                        />
                    ))}
                </div>

                <div
                    style={{
                        marginBottom: 10,
                        fontSize: 12,
                        fontWeight: 700,
                    }}
                >
                    Re-usable Jars
                </div>

                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                    }}
                >
                    {DC_JARS.map((size) => (
                        <Pill
                            key={size}
                            label={size}
                            active={!!(products.dc || {})[size]}
                            onClick={() =>
                                toggleList("dc", size)
                            }
                        />
                    ))}
                </div>
            </Card>

            <Card>
                <CardTitle icon="🫙">
                    Raha Cocoa Powder
                </CardTitle>

                <div
                    style={{
                        marginBottom: 10,
                        fontSize: 12,
                        fontWeight: 700,
                    }}
                >
                    Sachets
                </div>

                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        marginBottom: 12,
                    }}
                >
                    {COCOA_SACHETS.map((size) => (
                        <Pill
                            key={size}
                            label={size}
                            active={!!(products.cocoa || {})[size]}
                            onClick={() =>
                                toggleList("cocoa", size)
                            }
                        />
                    ))}
                </div>

                <div
                    style={{
                        marginBottom: 10,
                        fontSize: 12,
                        fontWeight: 700,
                    }}
                >
                    Re-usable Jars
                </div>

                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                    }}
                >
                    {COCOA_JARS.map((size) => (
                        <Pill
                            key={size}
                            label={size}
                            active={!!(products.cocoa || {})[size]}
                            onClick={() =>
                                toggleList("cocoa", size)
                            }
                        />
                    ))}
                </div>
            </Card>

            <Card>
                <CardTitle icon="⚡">
                    Excel Glucose
                </CardTitle>

                <div
                    style={{
                        marginBottom: 10,
                        fontSize: 12,
                        fontWeight: 700,
                    }}
                >
                    Sachets
                </div>

                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        marginBottom: 12,
                    }}
                >
                    {GLUC_SACHETS.map((size) => (
                        <Pill
                            key={size}
                            label={size}
                            active={!!(products.gluc || {})[size]}
                            onClick={() =>
                                toggleList("gluc", size)
                            }
                        />
                    ))}
                </div>

                <div
                    style={{
                        marginBottom: 10,
                        fontSize: 12,
                        fontWeight: 700,
                    }}
                >
                    Packets
                </div>

                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        marginBottom: 12,
                    }}
                >
                    {GLUC_PKTS.map((size) => (
                        <Pill
                            key={size}
                            label={size}
                            active={!!(products.gluc || {})[size]}
                            onClick={() =>
                                toggleList("gluc", size)
                            }
                        />
                    ))}
                </div>

                <div
                    style={{
                        marginBottom: 10,
                        fontSize: 12,
                        fontWeight: 700,
                    }}
                >
                    Jars
                </div>

                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                    }}
                >
                    {GLUC_JARS.map((size) => (
                        <Pill
                            key={size}
                            label={size}
                            active={!!(products.gluc || {})[size]}
                            onClick={() =>
                                toggleList("gluc", size)
                            }
                        />
                    ))}
                </div>
            </Card>
                        <Card>
                <CardTitle icon="🍹">GoFrut</CardTitle>

                <SimpleMatrix
                    label="Sizes × Flavours"
                    sizes={GOFRUT_SIZES}
                    flavours={GOFRUT_FLAVOURS}
                    checked={products.gofrut || {}}
                    onChange={updateMatrix("gofrut")}
                />
            </Card>

            <Card>
                <CardTitle icon="🍓">Fruit Full</CardTitle>

                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                    }}
                >
                    {FF_FLAVOURS.map((item) => (
                        <Pill
                            key={item.k}
                            label={item.l}
                            active={!!(products.ff || {})[item.k]}
                            onClick={() =>
                                toggleList("ff", item.k)
                            }
                        />
                    ))}
                </div>
            </Card>

            <Card>
                <CardTitle icon="🔋">Energy Drink</CardTitle>

                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                    }}
                >
                    {ENERGY_SIZES.map((size) => (
                        <Pill
                            key={size}
                            label={size}
                            active={!!(products.energy || {})[size]}
                            onClick={() =>
                                toggleList("energy", size)
                            }
                        />
                    ))}
                </div>
            </Card>
                        <Card>
                <CardTitle icon="🎬">Warner Bros</CardTitle>

                <SimpleMatrix
                    label="Sizes × Flavours"
                    sizes={WB_SIZES}
                    flavours={WB_FLAVOURS}
                    checked={products.wb || {}}
                    onChange={updateMatrix("wb")}
                />
            </Card>

            <Card>
                <CardTitle icon="🏃">Reload Isotonic</CardTitle>

                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                    }}
                >
                    {RELOAD_SIZES.map((size) => (
                        <Pill
                            key={size}
                            label={size}
                            active={!!(products.reload || {})[size]}
                            onClick={() =>
                                toggleList("reload", size)
                            }
                        />
                    ))}
                </div>
            </Card>

            <Card>
                <CardTitle icon="🍬">Jelly Pop</CardTitle>

                <SimpleMatrix
                    label="Sizes × Flavours"
                    sizes={JP_SIZES}
                    flavours={JP_FLAVOURS}
                    checked={products.jp || {}}
                    onChange={updateMatrix("jp")}
                />
            </Card>

        </>
    );
}